"""Processa AI - Async Job Worker

This worker processes jobs from a Redis queue for:
- AI jobs (CNIS analysis, Process Summary)
- Office jobs (Google Calendar sync, etc.)
"""

import asyncio
import base64
import hashlib
import uuid

from src.core.ai_worker_store import (
    add_job_event,
    create_document,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
    parse_job_uuid,
)
from src.core.config import settings
from src.core.db import init_db
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.queue import dequeue_job, set_job_status
from src.handlers.ai_service import AiService

ai_service = AiService()


def _encode_bytes(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


async def _safe_set_job_status(job_id: str, status_payload: dict) -> None:
    try:
        await set_job_status(job_id, status_payload)
    except Exception:
        logger.exception("Failed to persist job status in Redis")


# Costs mapping (must match backend/src/features/billing/credits/constants.py)
JOB_COSTS = {
    "cnis_analysis": 5,
    "process_summary": 5,
    "labor_claim": 5,
    "brief_scanner": 3,
}


async def _validate_job_basic(job: dict) -> tuple[str, uuid.UUID | None, str, dict] | None:
    """Extract and validate basic job info. Returns (job_id, job_uuid, job_type, payload) or None if invalid."""
    job_id = str(job.get("job_id") or "").strip()
    if not job_id:
        return None

    job_uuid: uuid.UUID | None = None
    raw_uuid = (job.get("job_uuid") or "").strip() if isinstance(job.get("job_uuid"), str) else None
    if raw_uuid:
        try:
            job_uuid = uuid.UUID(raw_uuid)
        except Exception:
            job_uuid = None
    if job_uuid is None:
        job_uuid = parse_job_uuid(job_id)

    job_type = str(job.get("type") or "").strip()
    if job_type not in ("cnis_analysis", "process_summary", "labor_claim", "brief_scanner"):
        await _safe_set_job_status(
            job_id,
            {"job_id": job_id, "status": "failed", "error": "Tipo inválido"},
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Tipo inválido")
                await add_job_event(job_uuid=job_uuid, event_type="failed", message="Tipo inválido")
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return None

    payload = job.get("payload")
    if not isinstance(payload, dict):
        await _safe_set_job_status(
            job_id,
            {"job_id": job_id, "status": "failed", "error": "Payload inválido"},
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Payload inválido")
                await add_job_event(
                    job_uuid=job_uuid, event_type="failed", message="Payload inválido"
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return None

    return job_id, job_uuid, job_type, payload


async def _prepare_files(
    job_id: str, job_uuid: uuid.UUID | None, job_type: str, payload: dict
) -> tuple[str, list[str], str | None, str | None] | None:
    """Handle file URLs and signed URL generation."""
    is_multi_file = job_type in ("labor_claim", "brief_scanner")
    file_url = ""
    file_urls = []
    bucket = None
    storage_path = None

    if is_multi_file:
        files_list = payload.get("files") or []
        file_urls = [str(f.get("file_url") or "") for f in files_list if f.get("file_url")]

        # labor_claim may have no files (text-only), but brief_scanner requires at least one
        if job_type == "brief_scanner" and not file_urls:
            await _safe_set_job_status(
                job_id,
                {"job_id": job_id, "status": "failed", "error": "Nenhum arquivo enviado"},
            )
            if job_uuid:
                try:
                    await mark_job_failed(job_uuid=job_uuid, error="Nenhum arquivo enviado")
                    await add_job_event(
                        job_uuid=job_uuid, event_type="failed", message="Nenhum arquivo enviado"
                    )
                except Exception:
                    logger.exception("Failed to persist job failure in database")
            return None
    else:
        file_url = str(payload.get("file_url") or "").strip()
        bucket = str(payload.get("bucket") or "").strip()
        storage_path = str(payload.get("storage_path") or "").strip()

        # If we have bucket + storage_path but no file_url (or expired), generate a signed URL
        # NOTE: Backend usually sends signed URL in file_url, but if it's missing or we need to refresh:
        if bucket and storage_path and not file_url:
            try:
                from src.core.storage import StorageService

                storage = StorageService()
                file_url = await storage.generate_signed_url(
                    bucket=bucket, storage_path=storage_path, expires_in=3600
                )
                logger.info(
                    "Generated signed URL successfully for bucket=%s path=%s", bucket, storage_path
                )
            except Exception as e:
                logger.error("Failed to generate signed URL: %s", e, exc_info=True)

        # file_urls = []  # not used for single-file (implicitly handled by initialization)

    return file_url, file_urls, bucket, storage_path


async def _execute_ai_service(
    job_type: str,
    job_id: str,
    job_uuid: uuid.UUID | None,
    payload: dict,
    file_url: str,
    file_urls: list[str],
) -> dict:
    """Execute the specific AI service logic."""
    user_id = str(payload.get("user_id") or "").strip()
    client_id = payload.get("client_id")
    store_pdf = bool(payload.get("store_pdf"))
    store_input_pdf = bool(payload.get("store_input_pdf", True))
    expires_in = int(payload.get("signed_url_expires_in") or 600)
    functionality = str(payload.get("functionality") or "ai").strip()

    # Mark as processing
    await _safe_set_job_status(job_id, {"job_id": job_id, "status": "processing", "progress": 5})
    if job_uuid:
        try:
            await mark_job_processing(job_uuid=job_uuid, progress=5)
            await add_job_event(job_uuid=job_uuid, event_type="processing", payload={"progress": 5})
        except Exception:
            logger.exception("Failed to persist job processing in database")

    # Create progress reporter for real-time updates
    progress = ProgressReporter(job_id=job_id, job_uuid=job_uuid)

    if job_type == "labor_claim":
        user_prompt = str(payload.get("prompt") or "").strip()
        return await ai_service.analyze_labor_claim(
            file_urls=file_urls,
            user_prompt=user_prompt,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )
    elif job_type == "brief_scanner":
        return await ai_service.analyze_brief_scanner(
            file_urls=file_urls,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )
    elif job_type == "process_summary":
        return await ai_service.analyze_process_summary(
            file_url=file_url,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            store_input_pdf=store_input_pdf,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )
    else:  # cnis_analysis
        return await ai_service.analyze_cnis(
            file_url=file_url,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            store_input_pdf=store_input_pdf,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )


async def _handle_failure(
    e: Exception,
    job_id: str,
    job_uuid: uuid.UUID | None,
    job_type: str,
    user_id: str,
    payload: dict,
    bucket: str | None,
    storage_path: str | None,
) -> None:
    """Handle job failure, cleanup files, and refund credits."""
    err = str(getattr(e, "detail", None) or str(e) or "Erro")
    await _safe_set_job_status(
        job_id,
        {"job_id": job_id, "status": "failed", "progress": 100, "error": err},
    )
    if job_uuid:
        try:
            # 1. Mark job as failed in DB
            await mark_job_failed(job_uuid=job_uuid, error=err)
            await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)

            input_document_id = payload.get("input_document_id")
            is_multi_file = job_type in ("labor_claim", "brief_scanner")
            files_list = payload.get("files") or []

            # 2. Cleanup file from bucket if not saved in DB (input_document_id check?)
            if not input_document_id and not is_multi_file and bucket and storage_path:
                try:
                    from src.core.storage import StorageService

                    storage = StorageService()
                    await storage.delete_file(bucket=bucket, storage_path=storage_path)
                    logger.info(
                        f"Deleted temporary input file {bucket}/{storage_path} due to failure"
                    )
                except Exception as ex:
                    logger.warning(f"Failed to cleanup file {bucket}/{storage_path}: {ex}")

            # For multi-file, we iterate and delete
            if not input_document_id and is_multi_file and files_list:
                try:
                    from src.core.storage import StorageService

                    storage = StorageService()
                    for f in files_list:
                        b = f.get("bucket")
                        p = f.get("storage_path")
                        if b and p:
                            await storage.delete_file(bucket=b, storage_path=p)
                    logger.info(f"Deleted {len(files_list)} temporary input files due to failure")
                except Exception as ex:
                    logger.warning(f"Failed to cleanup files: {ex}")

            # 3. Refund credits
            cost = JOB_COSTS.get(job_type, 0)
            if cost > 0:
                logger.info(f"Refunding {cost} credits to user {user_id} due to job failure")
                await ai_service.refund_credits(user_id, cost, reason=f"refund_{job_type}_{job_id}")

        except Exception:
            logger.exception("Failed to persist job failure or refund credits")


async def _save_results(
    result: dict, job_id: str, job_uuid: uuid.UUID | None, job_type: str, payload: dict
) -> None:
    """Save job results, create documents, and update status."""
    user_id = str(payload.get("user_id") or "").strip()
    client_id = payload.get("client_id")
    store_pdf = bool(payload.get("store_pdf"))
    input_document_id = payload.get("input_document_id")

    status: dict = {"job_id": job_id, "status": "completed", "progress": 100}
    result_payload: dict = {}

    input_hash = result.get("input_hash")
    if input_hash:
        result_payload["input_hash"] = input_hash

    structured_summary = result.get("structured_summary")
    if structured_summary is not None and isinstance(structured_summary, dict):
        status["result"] = {
            **(status.get("result") or {}),
            "structured_summary": structured_summary,
        }
        result_payload["structured_summary"] = structured_summary

    # Note: Input document must be created by frontend and passed via input_document_id
    input_doc_id = input_document_id

    if store_pdf:
        bucket = result.get("bucket")
        storage_path = result.get("storage_path")
        pdf_bytes = result.get("content")

        if job_uuid and isinstance(bucket, str) and isinstance(storage_path, str):
            checksum = None
            size_bytes = None
            if isinstance(pdf_bytes, (bytes, bytearray)):
                raw = bytes(pdf_bytes)
                checksum = hashlib.sha256(raw).hexdigest()
                size_bytes = len(raw)

            filename = storage_path.rsplit("/", 1)[-1] if "/" in storage_path else storage_path
            try:
                doc_id = await create_document(
                    job_uuid=job_uuid,
                    user_id=user_id,
                    client_id=str(client_id) if client_id is not None else None,
                    document_type="output",
                    bucket=bucket,
                    storage_path=storage_path,
                    filename=filename,
                    checksum_sha256=checksum,
                    size_bytes=size_bytes,
                    metadata={"endpoint": job_type},
                    linked_document_id=input_doc_id,
                )
            except Exception:
                logger.exception("Failed to persist document in database")
                doc_id = None

            if doc_id:
                # Generate signed URL for the output document so frontend can preview it immediately
                try:
                    from src.core.storage import StorageService

                    storage = StorageService()
                    download_url = await storage.generate_signed_url(
                        bucket=bucket,
                        storage_path=storage_path,
                        expires_in=3600,  # 1 hour preview
                    )
                    status["result"] = {
                        **(status.get("result") or {}),
                        "document_id": str(doc_id),
                        "download_url": download_url,
                    }
                    result_payload["download_url"] = download_url
                except Exception as e:
                    logger.warning(f"Failed to generate preview URL for output document: {e}")
                    # Fallback to just document_id
                    status["result"] = {
                        **(status.get("result") or {}),
                        "document_id": str(doc_id),
                    }

                result_payload["document_id"] = str(doc_id)
                logger.info("Output document saved: %s", doc_id)
            else:
                status["result"] = {
                    **(status.get("result") or {}),
                    "bucket": bucket,
                    "storage_path": storage_path,
                }
                result_payload["bucket"] = bucket
                result_payload["storage_path"] = storage_path
        else:
            if isinstance(pdf_bytes, (bytes, bytearray)):
                status["result"] = {
                    **(status.get("result") or {}),
                    "content": _encode_bytes(bytes(pdf_bytes)),
                }
                result_payload["content_storage"] = "redis"
    else:
        content = result.get("content")
        if isinstance(content, (bytes, bytearray)):
            status["result"] = {
                **(status.get("result") or {}),
                "content": _encode_bytes(bytes(content)),
            }
            result_payload["content_storage"] = "redis"

    await _safe_set_job_status(job_id, status)
    if job_uuid:
        try:
            await mark_job_completed(job_uuid=job_uuid, result_payload=result_payload)
            await add_job_event(
                job_uuid=job_uuid, event_type="completed", payload={"progress": 100}
            )
        except Exception:
            logger.exception("Failed to persist job completion in database")


async def _handle_ai_job(job: dict) -> None:
    """Handle AI-related jobs (CNIS analysis, Process Summary)."""
    # 1. Validation
    validation_result = await _validate_job_basic(job)
    if not validation_result:
        return
    job_id, job_uuid, job_type, payload = validation_result

    user_id = str(payload.get("user_id") or "").strip()
    # Note: user_id check is partially done in validation, but logic requires check after files for single-file case?
    # Original code had complex logic for user_id/file_url/is_multi_file checks.
    # Let's replicate exact logic.

    # 2. Prepare Files
    files_result = await _prepare_files(job_id, job_uuid, job_type, payload)
    if not files_result:
        return
    file_url, file_urls, bucket, storage_path = files_result

    # Additional validation logic from original code
    is_multi_file = job_type in ("labor_claim", "brief_scanner")
    if not is_multi_file and (not file_url or not user_id):
        logger.info("is_multi_file: %s", is_multi_file)
        logger.info("file_url: %s", file_url)
        logger.info("user_id: %s", user_id)

        await _safe_set_job_status(
            job_id,
            {"job_id": job_id, "status": "failed", "error": "Dados inválidos"},
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Dados inválidos")
                await add_job_event(
                    job_uuid=job_uuid, event_type="failed", message="Dados inválidos"
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    if not user_id:
        await _safe_set_job_status(
            job_id,
            {"job_id": job_id, "status": "failed", "error": "user_id obrigatório"},
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="user_id obrigatório")
                await add_job_event(
                    job_uuid=job_uuid, event_type="failed", message="user_id obrigatório"
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    # 3. Execute
    try:
        result = await _execute_ai_service(job_type, job_id, job_uuid, payload, file_url, file_urls)
    except Exception as e:
        await _handle_failure(e, job_id, job_uuid, job_type, user_id, payload, bucket, storage_path)
        return

    # 4. Save Results
    await _save_results(result, job_id, job_uuid, job_type, payload)


async def _handle_office_job(job: dict) -> None:
    """Handle Office-related jobs (Google Calendar sync, etc.)."""
    job_id = str(job.get("job_id") or "").strip()
    job_type = str(job.get("type") or "").strip()

    logger.info("Processing office job: %s (type: %s)", job_id, job_type)

    await _safe_set_job_status(
        job_id,
        {
            "job_id": job_id,
            "status": "failed",
            "error": f"Office job type '{job_type}' not implemented yet",
        },
    )


async def _handle_job(job: dict) -> None:
    """Route job to appropriate handler based on job type."""
    job_type = str(job.get("type") or "").strip()

    if job_type in ("cnis_analysis", "process_summary", "labor_claim", "brief_scanner"):
        await _handle_ai_job(job)
        return

    if job_type.startswith("calendar_") or job_type.startswith("office_"):
        await _handle_office_job(job)
        return

    job_id = str(job.get("job_id") or "").strip()
    if job_id:
        await _safe_set_job_status(
            job_id,
            {"job_id": job_id, "status": "failed", "error": f"Unknown job type: {job_type}"},
        )


async def run_worker() -> None:
    """Main worker loop."""
    try:
        await init_db()
    except Exception:
        logger.exception("Failed to initialize database")

    logger.info("Processa AI Worker started - waiting for jobs...")

    while True:
        job = await dequeue_job(timeout_s=5)
        if not job:
            continue

        job_id = job.get("job_id", "unknown")
        job_type = job.get("type", "unknown")
        logger.info("Processing job: %s (type: %s)", job_id, job_type)

        try:
            await _handle_job(job)
        except Exception:
            logger.exception("Unhandled error processing job: %s", job_id)


def main() -> None:
    """Entry point."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
