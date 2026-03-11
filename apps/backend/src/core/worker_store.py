"""Store functions for the generic worker_jobs table (calculators, future services)."""

from __future__ import annotations

import uuid
from typing import Any

from src.core.db import get_pool


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


async def create_worker_job(
    *,
    job_uuid: uuid.UUID,
    job_type: str,
    user_id: str,
    client_id: str | None,
    request_payload: dict,
    status: str = "queued",
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "insert into public.worker_jobs (id, job_type, status, progress, user_id, "
                    "client_id, request_payload) "
                    "values (%s, %s, %s, 0, %s, %s, %s) "
                    "on conflict (id) do nothing"
                ),
                (job_uuid, job_type, status, user_id, client_id, _to_jsonb(request_payload)),
            )


async def add_worker_job_event(
    *,
    job_uuid: uuid.UUID,
    event_type: str,
    message: str | None = None,
    payload: dict | None = None,
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "insert into public.worker_job_events (job_id, event_type, message, payload) "
                "values (%s, %s, %s, %s)",
                (
                    job_uuid,
                    event_type,
                    message,
                    _to_jsonb(payload) if payload is not None else None,
                ),
            )


async def mark_worker_job_processing(*, job_uuid: uuid.UUID, progress: int) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.worker_jobs "
                    "set status = 'processing', progress = %s, "
                    "started_at = coalesce(started_at, now()) "
                    "where id = %s"
                ),
                (int(progress), job_uuid),
            )


async def update_worker_job_progress(*, job_uuid: uuid.UUID, progress: int) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "update public.worker_jobs set progress = %s where id = %s",
                (int(progress), job_uuid),
            )


async def mark_worker_job_completed(*, job_uuid: uuid.UUID, result_payload: dict) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.worker_jobs "
                    "set status = 'completed', progress = 100, result_payload = %s, "
                    "finished_at = now() "
                    "where id = %s"
                ),
                (_to_jsonb(result_payload), job_uuid),
            )


async def mark_worker_job_failed(*, job_uuid: uuid.UUID, error: str) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.worker_jobs "
                    "set status = 'failed', progress = 100, error = %s, finished_at = now() "
                    "where id = %s"
                ),
                (error, job_uuid),
            )


async def create_calculator_document(
    *,
    worker_job_id: uuid.UUID,
    calculation_id: uuid.UUID | None = None,
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
) -> uuid.UUID | None:
    """Create a generated_documents row linked to a worker_job and a calculation."""
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
                    "(source, worker_job_id, calculation_id, user_id, client_id, document_type, "
                    "bucket, storage_path, filename, checksum_sha256, size_bytes, "
                    "mime_type, metadata) "
                    "values ('calculator', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "on conflict (bucket, storage_path) do update set "
                    "worker_job_id = excluded.worker_job_id, "
                    "calculation_id = excluded.calculation_id, "
                    "user_id = excluded.user_id, "
                    "client_id = excluded.client_id, "
                    "document_type = excluded.document_type, "
                    "filename = excluded.filename, "
                    "checksum_sha256 = excluded.checksum_sha256, "
                    "size_bytes = excluded.size_bytes, "
                    "mime_type = excluded.mime_type, "
                    "metadata = excluded.metadata "
                    "returning id"
                ),
                (
                    worker_job_id,
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


async def get_worker_job_status(*, job_uuid: uuid.UUID) -> dict | None:
    """Get worker job status with optional linked document."""
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
                    select j.status, j.progress, j.error, j.result_payload,
                    j.started_at, j.finished_at, d.id as output_doc_id
                    from public.worker_jobs j
                    left join public.generated_documents d
                    on d.worker_job_id = j.id
                    where j.id = %s
                """,
                (str(job_uuid),),
            )
            row = await cur.fetchone()
            if not row:
                return None

            result_payload = row.get("result_payload") or {}

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
            }
