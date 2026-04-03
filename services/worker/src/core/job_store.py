"""Unified store functions for the worker service.

Operates against:
  - public.jobs          — canonical job table for all job types
  - public.job_events    — structured event log per job
  - public.generated_documents — output/input documents linked to jobs
  - public.calculations  — calculator state (rescisao, aposentadoria, etc.)

This module merges and supersedes ai_worker_store.py and worker_store.py.
All table names and column names reflect the consolidated schema:
  - public.jobs (not ai_jobs / worker_jobs)
  - public.job_events (not ai_job_events / worker_job_events)
  - generated_documents.job_id (not worker_job_id)
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from src.core.db import get_pool


# ---------------------------------------------------------------------------
# psycopg 3 helpers (try-import so static analysers and unit tests don't break
# if psycopg is unavailable at import time)
# ---------------------------------------------------------------------------


def _to_jsonb(value: Any) -> Any:
    """Wrap a Python value in psycopg's Jsonb adapter for JSONB columns."""
    try:
        from psycopg.types.json import Jsonb as _Jsonb
    except ModuleNotFoundError:
        return value
    return _Jsonb(value)


def _get_dict_row():
    """Return psycopg's dict_row row factory, or None if unavailable."""
    try:
        from psycopg.rows import dict_row as _dict_row
    except ModuleNotFoundError:
        return None
    return _dict_row


# ---------------------------------------------------------------------------
# UUID parsing
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def parse_job_uuid(job_id: str) -> uuid.UUID | None:
    """Extract and parse the first UUID found in *job_id*.

    Accepts bare UUIDs, prefixed strings like ``"job:uuid"`` or any string
    that contains a UUID somewhere in it.  Returns ``None`` on failure rather
    than raising so callers can decide how to handle invalid input gracefully.
    """
    raw = (job_id or "").strip()
    if not raw:
        return None

    m = _UUID_RE.search(raw)
    if not m:
        return None

    try:
        return uuid.UUID(m.group(0))
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Job events  (public.job_events)
# ---------------------------------------------------------------------------


async def add_job_event(
    *,
    job_uuid: uuid.UUID,
    event_type: str,
    message: str | None = None,
    payload: dict | None = None,
) -> None:
    """Append a structured event to public.job_events for *job_uuid*."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO public.job_events (job_id, event_type, message, payload) "
                "VALUES (%s, %s, %s, %s)",
                (
                    job_uuid,
                    event_type,
                    message,
                    _to_jsonb(payload) if payload is not None else None,
                ),
            )


# ---------------------------------------------------------------------------
# Job status updates  (public.jobs)
# ---------------------------------------------------------------------------


async def mark_job_processing(*, job_uuid: uuid.UUID, progress: int) -> None:
    """Transition a job to *processing* and set its initial progress.

    ``started_at`` is only written on first transition (COALESCE guard) so
    repeated calls on the same job do not overwrite the original start time.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs "
                "SET status = 'processing', "
                "    progress = %s, "
                "    started_at = COALESCE(started_at, NOW()) "
                "WHERE id = %s",
                (int(progress), job_uuid),
            )


async def update_job_progress(*, job_uuid: uuid.UUID, progress: int) -> None:
    """Update *progress* without changing the job *status*.

    Useful for incremental updates during a long-running pipeline step.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs SET progress = %s WHERE id = %s",
                (int(progress), job_uuid),
            )


async def mark_job_completed(*, job_uuid: uuid.UUID, result_payload: dict) -> None:
    """Mark a job as successfully completed and persist its result."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs "
                "SET status = 'completed', "
                "    progress = 100, "
                "    result_payload = %s, "
                "    finished_at = NOW() "
                "WHERE id = %s",
                (_to_jsonb(result_payload), job_uuid),
            )


async def mark_job_failed(*, job_uuid: uuid.UUID, error: str) -> None:
    """Mark a job as failed and record the error message."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs "
                "SET status = 'failed', "
                "    progress = 100, "
                "    error = %s, "
                "    finished_at = NOW() "
                "WHERE id = %s",
                (error, job_uuid),
            )


# ---------------------------------------------------------------------------
# Document creation  (public.generated_documents)
# ---------------------------------------------------------------------------


async def create_document(
    *,
    job_uuid: uuid.UUID,
    user_id: str,
    client_id: str | None,
    document_type: str,
    bucket: str,
    storage_path: str,
    filename: str,
    checksum_sha256: str | None,
    size_bytes: int | None,
    mime_type: str = "application/pdf",
    metadata: dict | None = None,
    linked_document_id: uuid.UUID | None = None,
    source: str = "ai",
    calculation_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Insert a row into public.generated_documents and return its UUID.

    Handles both AI-generated documents (source='ai') and calculator reports
    (source='calculator') through a single unified function.  The *job_id*
    column is used for the job reference — the old *worker_job_id* column no
    longer exists in the schema.

    On a ``(bucket, storage_path)`` conflict the row is upserted so that
    re-processing a job updates the document metadata instead of failing.

    Args:
        job_uuid: UUID of the job that produced this document.
        user_id: Owner of the document.
        client_id: Optional office client associated with the document.
        document_type: Semantic type such as ``'input'`` or ``'output'``.
        bucket: Supabase Storage bucket name.
        storage_path: Path within the bucket.
        filename: Human-readable filename for download.
        checksum_sha256: Optional SHA-256 hex digest of the file content.
        size_bytes: File size in bytes.
        mime_type: MIME type (defaults to ``'application/pdf'``).
        metadata: Arbitrary JSON metadata stored alongside the document.
        linked_document_id: Optional FK to another document (e.g. input→output).
        source: ``'ai'`` or ``'calculator'`` — determines document origin.
        calculation_id: Optional FK to public.calculations for calculator docs.

    Returns:
        The new (or existing) document UUID, or ``None`` on failure.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        cur_cm = conn.cursor(row_factory=row_factory) if row_factory else conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                "INSERT INTO public.generated_documents "
                "(source, job_id, calculation_id, user_id, client_id, document_type, "
                " bucket, storage_path, filename, checksum_sha256, size_bytes, "
                " mime_type, metadata, linked_document_id) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (bucket, storage_path) DO UPDATE SET "
                "    job_id             = EXCLUDED.job_id, "
                "    calculation_id     = EXCLUDED.calculation_id, "
                "    user_id            = EXCLUDED.user_id, "
                "    client_id          = EXCLUDED.client_id, "
                "    document_type      = EXCLUDED.document_type, "
                "    filename           = EXCLUDED.filename, "
                "    checksum_sha256    = EXCLUDED.checksum_sha256, "
                "    size_bytes         = EXCLUDED.size_bytes, "
                "    mime_type          = EXCLUDED.mime_type, "
                "    metadata           = EXCLUDED.metadata, "
                "    linked_document_id = EXCLUDED.linked_document_id "
                "RETURNING id",
                (
                    source,
                    job_uuid,
                    calculation_id,
                    user_id,
                    client_id,
                    document_type,
                    bucket,
                    storage_path,
                    filename,
                    checksum_sha256,
                    size_bytes,
                    mime_type,
                    _to_jsonb(metadata) if metadata is not None else None,
                    linked_document_id,
                ),
            )
            row = await cur.fetchone()
            if not row:
                return None

            doc_id = row.get("id") if isinstance(row, dict) else row[0]
            if isinstance(doc_id, uuid.UUID):
                return doc_id
            try:
                return uuid.UUID(str(doc_id))
            except Exception:
                return None


# ---------------------------------------------------------------------------
# Calculation status updates  (public.calculations)
# ---------------------------------------------------------------------------


async def mark_calculation_completed(
    *, calculation_id: uuid.UUID, output_payload: dict
) -> None:
    """Persist a successful calculation result in public.calculations.

    Called after the calculator engine finishes so the backend can serve the
    result payload directly from the calculations table.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.calculations "
                "SET status = 'completed', "
                "    output_payload = %s, "
                "    finished_at = NOW() "
                "WHERE id = %s",
                (_to_jsonb(output_payload), calculation_id),
            )


async def mark_calculation_failed(*, calculation_id: uuid.UUID, error: str) -> None:
    """Record a calculation failure in public.calculations."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.calculations "
                "SET status = 'failed', "
                "    error = %s, "
                "    finished_at = NOW() "
                "WHERE id = %s",
                (error, calculation_id),
            )
