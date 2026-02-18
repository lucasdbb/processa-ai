from __future__ import annotations

import re
import uuid
from datetime import datetime
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


_UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)


def parse_job_uuid(job_id: str) -> uuid.UUID | None:
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


async def create_job(
    *,
    job_uuid: uuid.UUID,
    endpoint_key: str,
    user_id: str,
    client_id: str | None,
    request_payload: dict,
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "insert into public.ai_jobs (id, endpoint_key, status, progress, user_id, "
                    "client_id, request_payload) "
                    "values (%s, %s, 'queued', 0, %s, %s, %s) "
                    "on conflict (id) do nothing"
                ),
                (job_uuid, endpoint_key, user_id, client_id, _to_jsonb(request_payload)),
            )


async def get_endpoint_by_key(key: str) -> dict | None:
    """
    Busca um endpoint por key na tabela public.ai_endpoints.
    Retorna dict com dados do endpoint ou None se não encontrado.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row_factory = _get_dict_row()
        async with conn.cursor(row_factory=row_factory) as cur:
            await cur.execute(
                (
                    "select key, version, method, path, description, n8n_workflow_id, "
                    "is_active, created_at, updated_at "
                    "from public.ai_endpoints "
                    "where key = %s and is_active = true"
                ),
                (key,),
            )
            row = await cur.fetchone()
            return row


async def add_job_event(
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
                "insert into public.ai_job_events (job_id, event_type, message, payload) "
                "values (%s, %s, %s, %s)",
                (
                    job_uuid,
                    event_type,
                    message,
                    _to_jsonb(payload) if payload is not None else None,
                ),
            )


async def mark_job_processing(*, job_uuid: uuid.UUID, progress: int) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.ai_jobs "
                    "set status = 'processing', progress = %s, "
                    "started_at = coalesce(started_at, now()) "
                    "where id = %s"
                ),
                (int(progress), job_uuid),
            )


async def update_job_progress(*, job_uuid: uuid.UUID, progress: int) -> None:
    """Atualiza apenas o progresso de um job sem alterar status."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "update public.ai_jobs set progress = %s where id = %s",
                (int(progress), job_uuid),
            )


async def mark_job_completed(*, job_uuid: uuid.UUID, result_payload: dict) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.ai_jobs "
                    "set status = 'completed', progress = 100, result_payload = %s, "
                    "finished_at = now() "
                    "where id = %s"
                ),
                (_to_jsonb(result_payload), job_uuid),
            )


async def mark_job_failed(*, job_uuid: uuid.UUID, error: str) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.ai_jobs "
                    "set status = 'failed', progress = 100, error = %s, finished_at = now() "
                    "where id = %s"
                ),
                (error, job_uuid),
            )


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
) -> uuid.UUID | None:
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
                    "(source, job_id, user_id, client_id, document_type, bucket, storage_path, "
                    "filename, checksum_sha256, size_bytes, mime_type, metadata, "
                    "linked_document_id) "
                    "values ('ai', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "on conflict (bucket, storage_path) do update set "
                    "job_id = excluded.job_id, "
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
                    job_uuid,
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


async def get_job_status_from_db(*, job_uuid: uuid.UUID) -> dict | None:
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
                    "select status, progress, error, result_payload, started_at, finished_at "
                    "from public.ai_jobs where id = %s"
                ),
                (job_uuid,),
            )
            row = await cur.fetchone()
            if not row:
                return None

            result_payload = row.get("result_payload")
            return {
                "status": str(row.get("status") or "unknown"),
                "progress": int(row.get("progress") or 0),
                "error": (str(row.get("error")) if row.get("error") else None),
                "result": (result_payload if isinstance(result_payload, dict) else None),
                "started_at": row.get("started_at"),
                "finished_at": row.get("finished_at"),
            }


def now_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    try:
        return dt.isoformat()
    except Exception:
        return None


async def get_user_analysis_history(
    *, user_id: str, endpoint_key: str = "cnis_analysis", limit: int = 50, offset: int = 0
) -> list[dict]:
    """Busca histórico de análises de um usuário com input e output documents."""
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
                    j.result_payload,
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
                from public.ai_jobs j
                left join public.generated_documents d_input
                    on d_input.job_id = j.id and d_input.document_type = 'input'
                left join public.generated_documents d_output
                    on d_output.job_id = j.id and d_output.document_type = 'output'
                where j.user_id = %s and j.endpoint_key = %s
                order by j.created_at desc
                limit %s offset %s
                """,
                (user_id, endpoint_key, limit, offset),
            )
            rows = await cur.fetchall()
            return [dict(row) for row in rows] if rows else []


async def get_document_by_id(*, document_id: uuid.UUID) -> dict | None:
    """Busca documento por ID."""
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
