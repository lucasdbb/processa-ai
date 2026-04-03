"""Unified job store operating against the public.jobs table.

Replaces ai_worker_store.py (ai_jobs) and worker_store.py (worker_jobs) with a
single interface backed by public.jobs + public.job_events. The generated_documents
table uses job_id for all document types (both 'ai' and 'calculator' sources).
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any

from src.core.db import get_pool


# ---------------------------------------------------------------------------
# JSONB / dict_row helpers (try/except to survive environments without psycopg)
# ---------------------------------------------------------------------------

def _to_jsonb(value: Any) -> Any:
    try:
        from psycopg.types.json import Jsonb as _Jsonb
    except ModuleNotFoundError:
        return value
    return _Jsonb(value)


def _get_dict_row():
    try:
        from psycopg.rows import dict_row as _dict_row
    except ModuleNotFoundError:
        return None
    return _dict_row


# ---------------------------------------------------------------------------
# UUID helpers
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def parse_job_uuid(job_id: str) -> uuid.UUID | None:
    """Extract and parse the first UUID found in *job_id*, returning None on failure."""
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
# Endpoint registry
# ---------------------------------------------------------------------------

async def ensure_endpoint(
    *,
    key: str,
    path: str,
    version: str = "v1",
    method: str = "POST",
    description: str | None = None,
    n8n_workflow_id: str | None = None,
    is_active: bool = True,
) -> None:
    """Upsert an AI endpoint registration row."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "insert into public.ai_endpoints (key, version, method, path, description, "
                    "n8n_workflow_id, is_active) "
                    "values (%s, %s, %s, %s, %s, %s, %s) "
                    "on conflict (key) do update set "
                    "version = excluded.version, "
                    "method = excluded.method, "
                    "path = excluded.path, "
                    "description = excluded.description, "
                    "n8n_workflow_id = excluded.n8n_workflow_id, "
                    "is_active = excluded.is_active, "
                    "updated_at = now()"
                ),
                (key, version, method, path, description, n8n_workflow_id, is_active),
            )


async def get_endpoint_by_key(key: str) -> dict | None:
    """Return the ai_endpoints row for *key*, or None if not found."""
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        if row_factory:
            cur_cm = conn.cursor(row_factory=row_factory)
        else:
            cur_cm = conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                "select key, version, method, path, description, "
                "n8n_workflow_id, is_active "
                "from public.ai_endpoints "
                "where key = %s",
                (key,),
            )
            row = await cur.fetchone()
            return dict(row) if row else None


# ---------------------------------------------------------------------------
# Job CRUD
# ---------------------------------------------------------------------------

async def create_job(
    *,
    job_uuid: uuid.UUID,
    job_type: str,
    user_id: str | None,
    client_id: str | None,
    request_payload: dict,
    queue: str = "jobs",
    status: str = "queued",
    priority: int = 0,
) -> None:
    """Insert a new job row into public.jobs. No-op on duplicate id."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "insert into public.jobs "
                    "(id, job_type, queue, status, progress, priority, user_id, client_id, request_payload) "
                    "values (%s, %s, %s, %s, 0, %s, %s, %s, %s) "
                    "on conflict (id) do nothing"
                ),
                (
                    job_uuid,
                    job_type,
                    queue,
                    status,
                    priority,
                    user_id,
                    client_id,
                    _to_jsonb(request_payload),
                ),
            )


async def update_job_payload(
    *,
    job_uuid: uuid.UUID,
    request_payload: dict,
) -> None:
    """Replace the request_payload of an existing job."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "update public.jobs set request_payload = %s where id = %s",
                (_to_jsonb(request_payload), job_uuid),
            )


# ---------------------------------------------------------------------------
# Job events
# ---------------------------------------------------------------------------

async def add_job_event(
    *,
    job_uuid: uuid.UUID,
    event_type: str,
    message: str | None = None,
    payload: dict | None = None,
) -> None:
    """Append an event row to public.job_events for the given job."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "insert into public.job_events (job_id, event_type, message, payload) "
                "values (%s, %s, %s, %s)",
                (
                    job_uuid,
                    event_type,
                    message,
                    _to_jsonb(payload) if payload is not None else None,
                ),
            )


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

async def mark_job_processing(*, job_uuid: uuid.UUID, progress: int) -> None:
    """Transition a job to 'processing', recording started_at on the first call."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.jobs "
                    "set status = 'processing', progress = %s, "
                    "started_at = coalesce(started_at, now()) "
                    "where id = %s"
                ),
                (int(progress), job_uuid),
            )


async def mark_job_completed(*, job_uuid: uuid.UUID, result_payload: dict) -> None:
    """Transition a job to 'completed' with its final result payload."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.jobs "
                    "set status = 'completed', progress = 100, result_payload = %s, "
                    "finished_at = now() "
                    "where id = %s"
                ),
                (_to_jsonb(result_payload), job_uuid),
            )


async def mark_job_failed(*, job_uuid: uuid.UUID, error: str) -> None:
    """Transition a job to 'failed', recording the error message."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.jobs "
                    "set status = 'failed', progress = 100, error = %s, finished_at = now() "
                    "where id = %s"
                ),
                (error, job_uuid),
            )


async def update_job_progress(*, job_uuid: uuid.UUID, progress: int) -> None:
    """Update only the progress field without changing the job status."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "update public.jobs set progress = %s where id = %s",
                (int(progress), job_uuid),
            )


# ---------------------------------------------------------------------------
# Job status query
# ---------------------------------------------------------------------------

async def get_job_status(*, job_uuid: uuid.UUID) -> dict | None:
    """Return the current status of a job, injecting document_id into result if present.

    Queries public.jobs and LEFT JOINs generated_documents on job_id + document_type='output'.
    Returns None when the job does not exist.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        if row_factory:
            cur_cm = conn.cursor(row_factory=row_factory)
        else:
            cur_cm = conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                """
                select
                    j.status,
                    j.progress,
                    j.error,
                    j.result_payload,
                    j.started_at,
                    j.finished_at,
                    j.user_id,
                    d.id as output_doc_id
                from public.jobs j
                left join public.generated_documents d
                    on d.job_id = j.id
                    and d.document_type = 'output'
                where j.id = %s
                """,
                (str(job_uuid),),
            )
            row = await cur.fetchone()
            if not row:
                return None

            result_payload = row.get("result_payload") or {}

            # Inject document_id into the result dict when a linked output document exists
            if row.get("output_doc_id"):
                if isinstance(result_payload, dict):
                    result_payload["document_id"] = str(row.get("output_doc_id"))

            return {
                "status": str(row.get("status") or "unknown"),
                "progress": int(row.get("progress") or 0),
                "error": (str(row.get("error")) if row.get("error") else None),
                "result": (result_payload if isinstance(result_payload, dict) else None),
                "started_at": row.get("started_at"),
                "finished_at": row.get("finished_at"),
                "user_id": row.get("user_id"),
            }


# ---------------------------------------------------------------------------
# Document management
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
    """Upsert a generated_documents row linked to a job via job_id.

    *source* should be 'ai' for AI tool outputs or 'calculator' for PDF reports.
    *calculation_id* is optional and used only for calculator jobs.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        if row_factory:
            cur_cm = conn.cursor(row_factory=row_factory)
        else:
            cur_cm = conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                (
                    "insert into public.generated_documents "
                    "(source, job_id, calculation_id, user_id, client_id, document_type, "
                    "bucket, storage_path, filename, checksum_sha256, size_bytes, "
                    "mime_type, metadata, linked_document_id) "
                    "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "on conflict (bucket, storage_path) do update set "
                    "job_id = excluded.job_id, "
                    "calculation_id = excluded.calculation_id, "
                    "user_id = excluded.user_id, "
                    "client_id = excluded.client_id, "
                    "document_type = excluded.document_type, "
                    "filename = excluded.filename, "
                    "checksum_sha256 = excluded.checksum_sha256, "
                    "size_bytes = excluded.size_bytes, "
                    "mime_type = excluded.mime_type, "
                    "metadata = excluded.metadata, "
                    "linked_document_id = excluded.linked_document_id "
                    "returning id"
                ),
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
            doc_id = row.get("id")
            if isinstance(doc_id, uuid.UUID):
                return doc_id
            try:
                return uuid.UUID(str(doc_id))
            except Exception:
                return None


async def get_document_by_id(*, document_id: uuid.UUID) -> dict | None:
    """Fetch a generated_documents row by its primary key."""
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        if row_factory:
            cur_cm = conn.cursor(row_factory=row_factory)
        else:
            cur_cm = conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                """
                select id, user_id, document_type, bucket, storage_path,
                       filename, size_bytes, created_at
                from public.generated_documents
                where id = %s
                """,
                (document_id,),
            )
            row = await cur.fetchone()
            return dict(row) if row else None


# ---------------------------------------------------------------------------
# History queries
# ---------------------------------------------------------------------------

async def get_user_analysis_history(
    *,
    user_id: str,
    endpoint_key: str = "cnis_analysis",
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Return the job + document history for a user filtered by job_type.

    *endpoint_key* maps directly to the job_type column in public.jobs.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        if row_factory:
            cur_cm = conn.cursor(row_factory=row_factory)
        else:
            cur_cm = conn.cursor()

        async with cur_cm as cur:
            await cur.execute(
                """
                select
                    j.id as job_id,
                    j.status,
                    j.created_at,
                    j.finished_at,
                    jsonb_build_object(
                        'audit_score', j.result_payload->>'audit_score'
                    ) as result_payload,
                    d_input.id as input_doc_id,
                    d_input.filename as input_filename,
                    d_input.size_bytes as input_size,
                    d_input.storage_path as input_storage_path,
                    d_input.bucket as input_bucket,
                    d_input.created_at as input_created_at,
                    d_output.id as output_doc_id,
                    d_output.filename as output_filename,
                    d_output.size_bytes as output_size,
                    d_output.storage_path as output_storage_path,
                    d_output.bucket as output_bucket,
                    d_output.created_at as output_created_at
                from public.jobs j
                left join public.generated_documents d_input
                    on d_input.job_id = j.id and d_input.document_type = 'input'
                left join public.generated_documents d_output
                    on d_output.job_id = j.id and d_output.document_type = 'output'
                where j.user_id = %s and j.job_type = %s
                order by j.created_at desc
                limit %s offset %s
                """,
                (user_id, endpoint_key, limit, offset),
            )
            rows = await cur.fetchall()
            return [dict(row) for row in rows] if rows else []


async def get_all_user_jobs(
    *,
    user_id: str,
    client_id: str | None = None,
    endpoint_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Return completed/processing jobs for a user with optional filters.

    *endpoint_key* is matched against the job_type column (kept for API compatibility).
    """
    pool = await get_pool()
    query = """
        SELECT DISTINCT ON (j.created_at, j.id)
            j.id,
            j.created_at,
            j.status,
            j.job_type,
            jsonb_build_object(
                'files', j.request_payload->'files',
                'storage_path', j.request_payload->>'storage_path'
            ) as request_payload,
            jsonb_build_object(
                'download_url', j.result_payload->>'download_url',
                'pdf_url', j.result_payload->>'pdf_url',
                'content', j.result_payload->>'content',
                'text', j.result_payload->>'text'
            ) as result_payload,
            c.name as client_name,
            c.id as client_id,
            d.bucket as output_bucket,
            d.storage_path as output_storage_path,
            d.id as output_document_id
        FROM public.jobs j
        LEFT JOIN office_api.clients c ON j.client_id::text = c.id::text
        LEFT JOIN public.generated_documents d ON d.job_id = j.id AND d.document_type = 'output'
        WHERE j.status IN ('completed', 'processing') AND j.user_id = %s
    """
    params: list[Any] = [user_id]

    if endpoint_key:
        query += " AND j.job_type = %s"
        params.append(endpoint_key)

    if client_id:
        query += " AND j.client_id::text = %s"
        params.append(str(client_id))

    query += " ORDER BY j.created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            rows = await cur.fetchall()

            results = []
            for row in rows:
                results.append(
                    {
                        "id": str(row[0]),
                        "created_at": row[1],
                        "status": row[2],
                        "endpoint_key": row[3],  # kept as 'endpoint_key' for API compatibility
                        "request_payload": row[4],
                        "result_payload": row[5],
                        "client_name": row[6],
                        "client_id": str(row[7]) if row[7] else None,
                        "output_bucket": row[8],
                        "output_storage_path": row[9],
                        "output_document_id": str(row[10]) if row[10] else None,
                    }
                )
            return results


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

async def delete_job(*, job_uuid: uuid.UUID, user_id: str) -> bool:
    """Delete a job and all its generated_documents. Returns True if the job existed."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.transaction():
            async with conn.cursor() as cur:
                # Verify ownership before touching anything
                await cur.execute(
                    "select id from public.jobs where id = %s and user_id = %s",
                    (job_uuid, user_id),
                )
                row = await cur.fetchone()
                if not row:
                    return False

                # Remove linked documents first (FK constraint)
                await cur.execute(
                    "delete from public.generated_documents where job_id = %s",
                    (job_uuid,),
                )

                # Remove the job itself
                await cur.execute(
                    "delete from public.jobs where id = %s and user_id = %s",
                    (job_uuid, user_id),
                )
                return True


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def now_iso(dt: datetime | None) -> str | None:
    """Serialize a datetime to ISO 8601 string, returning None for falsy input."""
    if not dt:
        return None
    try:
        return dt.isoformat()
    except Exception:
        return None
