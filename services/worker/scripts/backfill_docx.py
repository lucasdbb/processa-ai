"""Backfill DOCX documents for existing AI jobs and calculator results.

Generates DOCX files retroactively for completed jobs/calculations that only
have a PDF. Uses the structured data already stored in the database — no LLM
or OCR calls are needed.

Usage (from the worker directory):
    uv run python -m scripts.backfill_docx [--dry-run] [--limit N]

Requires the same .env as the worker (DATABASE_URL, SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY).
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import sys
import uuid
from pathlib import Path

# Ensure the worker `src` package is importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.core.config import settings  # noqa: E402
from src.core.db import init_db, get_pool, close_db  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("backfill_docx")

DOCX_MIME = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

# ── Template function map ─────────────────────────────────────────────────

AI_TEMPLATE_MAP: dict[str, str] = {
    "cnis_analysis": "src.handlers.reports.cnis.generate_cnis_docx_from_template",
    "process_summary": "src.handlers.reports.process_summary.generate_process_summary_docx_from_template",
    "labor_claim": "src.handlers.reports.labor_claim.generate_labor_claim_docx_from_template",
    "brief_scanner": "src.handlers.reports.brief_scanner.generate_brief_scanner_docx_from_template",
}


def _import_template_fn(dotted_path: str):
    """Dynamically import a function by dotted module path."""
    module_path, fn_name = dotted_path.rsplit(".", 1)
    import importlib
    mod = importlib.import_module(module_path)
    return getattr(mod, fn_name)


# ── Helpers ───────────────────────────────────────────────────────────────

def _get_dict_row():
    try:
        from psycopg.rows import dict_row
        return dict_row
    except ModuleNotFoundError:
        return None


def _to_jsonb(value):
    try:
        from psycopg.types.json import Jsonb
        return Jsonb(value)
    except ModuleNotFoundError:
        return value


async def _upload_docx(docx_bytes: bytes, bucket: str, storage_path: str) -> None:
    """Upload DOCX bytes to Supabase Storage (upsert)."""
    import httpx

    base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
    api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
    upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            upload_url,
            headers={
                "apikey": api_key,
                "Authorization": f"Bearer {api_key}",
                "Content-Type": DOCX_MIME,
                "x-upsert": "true",
            },
            content=docx_bytes,
        )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"Upload failed (HTTP {resp.status_code}): {resp.text[:300]}"
        )


async def _insert_document(
    *,
    job_uuid: uuid.UUID | None,
    calculation_id: uuid.UUID | None,
    user_id: str,
    client_id: str | None,
    document_type: str,
    bucket: str,
    storage_path: str,
    filename: str,
    docx_bytes: bytes,
    source: str,
    metadata: dict | None = None,
) -> uuid.UUID | None:
    """Insert a generated_documents row for the DOCX. Returns the new doc UUID."""
    checksum = hashlib.sha256(docx_bytes).hexdigest()
    size_bytes = len(docx_bytes)

    pool = await get_pool()
    row_factory = _get_dict_row()
    async with pool.connection() as conn:
        kw = {"row_factory": row_factory} if row_factory else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                "INSERT INTO public.generated_documents "
                "(source, job_id, calculation_id, user_id, client_id, document_type, "
                " bucket, storage_path, filename, checksum_sha256, size_bytes, "
                " mime_type, metadata, expires_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
                " (SELECT CASE "
                "    WHEN bp.document_retention_days IS NOT NULL "
                "    THEN NOW() + (bp.document_retention_days || ' days')::INTERVAL "
                "    ELSE NULL "
                "  END "
                "  FROM public.subscriptions s "
                "  JOIN public.billing_plans bp ON bp.slug = s.plan_id "
                "  WHERE s.user_id = %s LIMIT 1)) "
                "ON CONFLICT (bucket, storage_path) DO UPDATE SET "
                "    document_type   = EXCLUDED.document_type, "
                "    filename        = EXCLUDED.filename, "
                "    checksum_sha256 = EXCLUDED.checksum_sha256, "
                "    size_bytes      = EXCLUDED.size_bytes, "
                "    mime_type       = EXCLUDED.mime_type, "
                "    metadata        = EXCLUDED.metadata, "
                "    expires_at      = EXCLUDED.expires_at "
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
                    checksum,
                    size_bytes,
                    DOCX_MIME,
                    _to_jsonb(metadata) if metadata else None,
                    user_id,
                ),
            )
            row = await cur.fetchone()
            if not row:
                return None
            raw_id = row["id"] if isinstance(row, dict) else row[0]
            return uuid.UUID(str(raw_id)) if raw_id else None


async def _update_result_payload(
    job_uuid: uuid.UUID, docx_doc_id: uuid.UUID
) -> None:
    """Add docx_document_id to the job's result_payload JSONB."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs "
                "SET result_payload = COALESCE(result_payload, '{}'::jsonb) "
                "    || jsonb_build_object('docx_document_id', %s) "
                "WHERE id = %s",
                (str(docx_doc_id), job_uuid),
            )


# ── AI Jobs backfill ──────────────────────────────────────────────────────

async def backfill_ai_jobs(*, dry_run: bool, limit: int) -> int:
    """Backfill DOCX for completed AI jobs that have a PDF but no DOCX."""
    pool = await get_pool()
    row_factory = _get_dict_row()

    async with pool.connection() as conn:
        kw = {"row_factory": row_factory} if row_factory else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                """
                SELECT j.id AS job_uuid,
                       j.job_type,
                       j.user_id,
                       j.client_id,
                       j.result_payload,
                       d_pdf.bucket AS pdf_bucket,
                       d_pdf.storage_path AS pdf_storage_path
                FROM public.jobs j
                JOIN public.generated_documents d_pdf
                  ON d_pdf.job_id = j.id
                  AND d_pdf.document_type = 'output'
                  AND d_pdf.mime_type = 'application/pdf'
                LEFT JOIN public.generated_documents d_docx
                  ON d_docx.job_id = j.id
                  AND d_docx.document_type = 'output_docx'
                WHERE j.status = 'completed'
                  AND j.job_type IN ('cnis_analysis', 'process_summary',
                                     'labor_claim', 'brief_scanner')
                  AND d_docx.id IS NULL
                ORDER BY j.created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = await cur.fetchall()

    if not rows:
        logger.info("No AI jobs need DOCX backfill.")
        return 0

    logger.info("Found %d AI job(s) to backfill.", len(rows))
    success = 0

    for row in rows:
        r = dict(row) if isinstance(row, dict) else {}
        if not r:
            continue

        job_uuid = r["job_uuid"]
        endpoint_key = r["job_type"]
        user_id = r["user_id"]
        client_id = r.get("client_id")
        result_payload = r.get("result_payload") or {}
        pdf_bucket = r["pdf_bucket"]
        pdf_storage_path = r["pdf_storage_path"]

        structured_data = result_payload.get("structured_data")
        if not structured_data or not isinstance(structured_data, dict):
            logger.warning(
                "  [SKIP] Job %s (%s): no structured_data in result_payload",
                job_uuid, endpoint_key,
            )
            continue

        template_dotted = AI_TEMPLATE_MAP.get(endpoint_key)
        if not template_dotted:
            logger.warning(
                "  [SKIP] Job %s: unknown endpoint_key '%s'",
                job_uuid, endpoint_key,
            )
            continue

        # Derive DOCX path from PDF path
        if pdf_storage_path.lower().endswith(".pdf"):
            docx_storage_path = pdf_storage_path[:-4] + ".docx"
        else:
            docx_storage_path = pdf_storage_path + ".docx"

        docx_filename = (
            docx_storage_path.rsplit("/", 1)[-1]
            if "/" in docx_storage_path
            else docx_storage_path
        )

        if dry_run:
            logger.info(
                "  [DRY-RUN] Would backfill job %s (%s) → %s/%s",
                job_uuid, endpoint_key, pdf_bucket, docx_storage_path,
            )
            success += 1
            continue

        try:
            generate_fn = _import_template_fn(template_dotted)
            docx_bytes = generate_fn(structured_data)

            await _upload_docx(docx_bytes, pdf_bucket, docx_storage_path)

            doc_id = await _insert_document(
                job_uuid=uuid.UUID(str(job_uuid)),
                calculation_id=None,
                user_id=user_id,
                client_id=str(client_id) if client_id else None,
                document_type="output_docx",
                bucket=pdf_bucket,
                storage_path=docx_storage_path,
                filename=docx_filename,
                docx_bytes=docx_bytes,
                source="ai",
                metadata={"endpoint": endpoint_key, "backfill": True},
            )

            if doc_id:
                await _update_result_payload(
                    uuid.UUID(str(job_uuid)), doc_id
                )

            logger.info(
                "  [OK] Job %s (%s) → doc %s", job_uuid, endpoint_key, doc_id
            )
            success += 1
        except Exception:
            logger.exception(
                "  [FAIL] Job %s (%s)", job_uuid, endpoint_key
            )

    return success


# ── Calculator backfill ───────────────────────────────────────────────────

async def backfill_calculator_rescisao(*, dry_run: bool, limit: int) -> int:
    """Backfill DOCX for completed rescisão calculations that have PDF but no DOCX."""
    pool = await get_pool()
    row_factory = _get_dict_row()

    async with pool.connection() as conn:
        kw = {"row_factory": row_factory} if row_factory else {}
        async with conn.cursor(**kw) as cur:
            await cur.execute(
                """
                SELECT c.id AS calc_id,
                       c.user_id,
                       c.client_id,
                       c.input_payload,
                       c.output_payload,
                       d_pdf.bucket AS pdf_bucket,
                       d_pdf.storage_path AS pdf_storage_path,
                       d_pdf.job_id AS job_uuid
                FROM public.calculations c
                JOIN public.generated_documents d_pdf
                  ON d_pdf.calculation_id = c.id
                  AND d_pdf.mime_type = 'application/pdf'
                LEFT JOIN public.generated_documents d_docx
                  ON d_docx.calculation_id = c.id
                  AND d_docx.mime_type = %s
                WHERE c.status = 'completed'
                  AND c.calculator_key = 'trabalhista.rescisao-trabalhista'
                  AND d_docx.id IS NULL
                ORDER BY c.created_at DESC
                LIMIT %s
                """,
                (DOCX_MIME, limit),
            )
            rows = await cur.fetchall()

    if not rows:
        logger.info("No calculator rescisão results need DOCX backfill.")
        return 0

    logger.info("Found %d rescisão calculation(s) to backfill.", len(rows))
    success = 0

    for row in rows:
        r = dict(row) if isinstance(row, dict) else {}
        if not r:
            continue

        calc_id = r["calc_id"]
        user_id = r["user_id"]
        client_id = r.get("client_id")
        input_payload = r.get("input_payload") or {}
        output_payload = r.get("output_payload") or {}
        pdf_bucket = r["pdf_bucket"]
        pdf_storage_path = r["pdf_storage_path"]
        job_uuid = r.get("job_uuid")

        if not input_payload or not output_payload:
            logger.warning(
                "  [SKIP] Calc %s: missing input/output payload", calc_id
            )
            continue

        if pdf_storage_path.lower().endswith(".pdf"):
            docx_storage_path = pdf_storage_path[:-4] + ".docx"
        else:
            docx_storage_path = pdf_storage_path + ".docx"

        docx_filename = (
            docx_storage_path.rsplit("/", 1)[-1]
            if "/" in docx_storage_path
            else docx_storage_path
        )

        if dry_run:
            logger.info(
                "  [DRY-RUN] Would backfill calc %s → %s/%s",
                calc_id, pdf_bucket, docx_storage_path,
            )
            success += 1
            continue

        try:
            from src.handlers.reports.rescisao import (
                generate_rescisao_docx_from_template,
            )

            docx_bytes = generate_rescisao_docx_from_template(
                input_payload=input_payload, output_payload=output_payload
            )

            await _upload_docx(docx_bytes, pdf_bucket, docx_storage_path)

            doc_id = await _insert_document(
                job_uuid=uuid.UUID(str(job_uuid)) if job_uuid else None,
                calculation_id=uuid.UUID(str(calc_id)),
                user_id=user_id,
                client_id=str(client_id) if client_id else None,
                document_type="calculator_rescisao_docx",
                bucket=pdf_bucket,
                storage_path=docx_storage_path,
                filename=docx_filename,
                docx_bytes=docx_bytes,
                source="calculator",
                metadata={"calculator_key": "trabalhista.rescisao-trabalhista", "backfill": True},
            )

            if doc_id and job_uuid:
                await _update_result_payload(
                    uuid.UUID(str(job_uuid)), doc_id
                )

            logger.info("  [OK] Calc %s → doc %s", calc_id, doc_id)
            success += 1
        except Exception:
            logger.exception("  [FAIL] Calc %s", calc_id)

    return success


# ── Main ──────────────────────────────────────────────────────────────────

async def main(*, dry_run: bool, limit: int) -> None:
    settings.validate()
    await init_db()

    try:
        logger.info("=" * 60)
        logger.info("DOCX Backfill — %s", "DRY RUN" if dry_run else "LIVE")
        logger.info("=" * 60)

        ai_count = await backfill_ai_jobs(dry_run=dry_run, limit=limit)
        calc_count = await backfill_calculator_rescisao(dry_run=dry_run, limit=limit)

        logger.info("-" * 60)
        logger.info(
            "Done. AI jobs: %d  |  Calculator: %d  |  Total: %d",
            ai_count, calc_count, ai_count + calc_count,
        )
    finally:
        await close_db()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill DOCX for old jobs")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be backfilled without making changes",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Max rows to process per category (default: 500)",
    )
    args = parser.parse_args()

    # Windows ships ProactorEventLoop by default, which psycopg doesn't
    # support. Force SelectorEventLoop so async DB connections work.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(main(dry_run=args.dry_run, limit=args.limit))
