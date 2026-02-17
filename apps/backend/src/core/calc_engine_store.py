from __future__ import annotations

import hashlib
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


async def create_calculation(
    *,
    calculation_id: uuid.UUID,
    calculator_key: str,
    user_id: str,
    client_id: str | None,
    input_payload: dict,
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "insert into public.calculations "
                    "(id, calculator_key, status, user_id, client_id, input_payload) "
                    "values (%s, %s, 'processing', %s, %s, %s) "
                    "on conflict (id) do nothing"
                ),
                (calculation_id, calculator_key, user_id, client_id, _to_jsonb(input_payload)),
            )


async def mark_calculation_completed(
    *,
    calculation_id: uuid.UUID,
    output_payload: dict,
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.calculations "
                    "set status = 'completed', output_payload = %s, error = null, "
                    "finished_at = now() "
                    "where id = %s"
                ),
                (_to_jsonb(output_payload), calculation_id),
            )


async def mark_calculation_failed(
    *,
    calculation_id: uuid.UUID,
    error: str,
) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                (
                    "update public.calculations "
                    "set status = 'failed', error = %s, finished_at = now() "
                    "where id = %s"
                ),
                (error, calculation_id),
            )


async def create_document(
    *,
    calculation_id: uuid.UUID,
    user_id: str,
    client_id: str | None,
    document_type: str,
    bucket: str,
    storage_path: str,
    filename: str,
    content_bytes: bytes,
    mime_type: str = "application/pdf",
    metadata: dict | None = None,
) -> uuid.UUID | None:
    checksum_sha256 = hashlib.sha256(content_bytes).hexdigest()
    size_bytes = len(content_bytes)

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
                    "(source, calculation_id, user_id, client_id, document_type, "
                    "bucket, storage_path, filename, "
                    "checksum_sha256, size_bytes, mime_type, metadata) "
                    "values ('calculator', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
                    "on conflict (bucket, storage_path) do update set "
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
            raw_id = row.get("id")
            if isinstance(raw_id, uuid.UUID):
                return raw_id
            try:
                return uuid.UUID(str(raw_id))
            except Exception:
                return None
