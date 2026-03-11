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


async def list_calculations(
    *,
    user_id: str,
    calculator_key: str | None = None,
    client_id: str | None = None,
    limit: int = 50,
) -> list[dict]:
    pool = await get_pool()
    row_factory = _get_dict_row()

    clauses = ["c.user_id = %s"]
    params: list[Any] = [user_id]

    if calculator_key:
        clauses.append("c.calculator_key = %s")
        params.append(calculator_key)
    if client_id:
        clauses.append("c.client_id = %s")
        params.append(client_id)

    where = " AND ".join(clauses)
    params.append(limit)

    async with pool.connection() as conn:
        kw = {"row_factory": row_factory} if row_factory else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                f"SELECT c.id, c.calculator_key, c.status, c.user_id, c.client_id, "
                f"c.input_payload, c.output_payload, c.error, c.created_at, c.finished_at, "
                f"d.id AS document_id "
                f"FROM public.calculations c "
                f"LEFT JOIN public.generated_documents d "
                f"ON d.calculation_id = c.id AND d.document_type = 'output' "
                f"WHERE {where} "
                f"ORDER BY c.created_at DESC LIMIT %s",
                params,
            )
            rows = await cur.fetchall()

    if not rows:
        return []

    result = []
    for row in rows:
        if isinstance(row, dict):
            item = dict(row)
        else:
            item = {
                "id": row[0],
                "calculator_key": row[1],
                "status": row[2],
                "user_id": row[3],
                "client_id": row[4],
                "input_payload": row[5],
                "output_payload": row[6],
                "error": row[7],
                "created_at": row[8],
                "finished_at": row[9],
                "document_id": row[10],
            }
        # Serialize UUID and datetime
        for uid_key in ("id", "document_id"):
            if isinstance(item.get(uid_key), uuid.UUID):
                item[uid_key] = str(item[uid_key])
        for dt_key in ("created_at", "finished_at"):
            v = item.get(dt_key)
            if v is not None and hasattr(v, "isoformat"):
                item[dt_key] = v.isoformat()
        result.append(item)

    return result


async def get_calculation_document(
    *,
    calculation_id: uuid.UUID,
    user_id: str,
) -> dict | None:
    pool = await get_pool()
    row_factory = _get_dict_row()

    async with pool.connection() as conn:
        kw = {"row_factory": row_factory} if row_factory else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                "SELECT id, bucket, storage_path, filename, mime_type "
                "FROM public.generated_documents "
                "WHERE calculation_id = %s AND user_id = %s "
                "ORDER BY created_at DESC LIMIT 1",
                (calculation_id, user_id),
            )
            row = await cur.fetchone()

    if not row:
        return None

    if isinstance(row, dict):
        item = dict(row)
    else:
        item = {
            "id": row[0],
            "bucket": row[1],
            "storage_path": row[2],
            "filename": row[3],
            "mime_type": row[4],
        }
    if isinstance(item.get("id"), uuid.UUID):
        item["id"] = str(item["id"])
    return item


async def delete_calculation(*, calculation_id: uuid.UUID, user_id: str) -> bool:
    """Delete a calculation and its associated documents. Returns True if deleted."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            # Verify ownership
            await cur.execute(
                "SELECT id FROM public.calculations WHERE id = %s AND user_id = %s",
                (calculation_id, user_id),
            )
            row = await cur.fetchone()
            if not row:
                return False

            # Delete associated documents first (FK)
            await cur.execute(
                "DELETE FROM public.generated_documents WHERE calculation_id = %s",
                (calculation_id,),
            )

            # Delete the calculation
            await cur.execute(
                "DELETE FROM public.calculations WHERE id = %s AND user_id = %s",
                (calculation_id, user_id),
            )
            return True


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
