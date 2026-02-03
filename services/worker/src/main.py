"""Processa AI - Async Job Worker

This worker processes jobs from a Redis queue for:
- AI jobs (CNIS analysis, etc.)
- Office jobs (Google Calendar sync, etc.)
"""

import asyncio
import base64
import hashlib
import os
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


async def _handle_ai_job(job: dict) -> None:
    """Handle AI-related jobs (CNIS analysis, etc.)."""
    job_id = str(job.get("job_id") or "").strip()
    if not job_id:
        return

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
    if job_type not in ("cnis_analysis", "process_summary"):
        await _safe_set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "error": "Tipo inválido",
            },
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Tipo inválido")
                await add_job_event(
                    job_uuid=job_uuid,
                    event_type="failed",
                    message="Tipo inválido",
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    payload = job.get("payload")
    if not isinstance(payload, dict):
        await _safe_set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "error": "Payload inválido",
            },
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Payload inválido")
                await add_job_event(
                    job_uuid=job_uuid,
                    event_type="failed",
                    message="Payload inválido",
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    file_url = str(payload.get("file_url") or "").strip()
    bucket = str(payload.get("bucket") or "").strip()
    storage_path = str(payload.get("storage_path") or "").strip()
    user_id = str(payload.get("user_id") or "").strip()

    # Se temos bucket e storage_path, gerar signed URL com service role key
    # Isso substitui qualquer file_url que possa ter vindo no payload
    if bucket and storage_path:
        try:
            import httpx

            base_url = settings.SUPABASE_URL.rstrip("/")
            api_key = settings.SUPABASE_SERVICE_ROLE_KEY

            sign_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}"
            logger.info(f"Generating signed URL from bucket={bucket}, path={storage_path[:50]}...")

            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    sign_url,
                    headers={
                        "apikey": api_key,
                        "Authorization": f"Bearer {api_key}",
                    },
                    json={"expiresIn": 3600},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    signed_path = data.get("signedURL") or ""
                    # Se a resposta for um caminho relativo, construir URL completa
                    if signed_path.startswith("/"):
                        file_url = f"{base_url}{signed_path}"
                    else:
                        file_url = signed_path
                    logger.info(f"Generated signed URL successfully: {file_url[:100]}")
                else:
                    logger.error(
                        f"Failed to generate signed URL: status {resp.status_code}, body: {resp.text[:200]}"
                    )
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}", exc_info=True)

    logger.info(f"Job {job_id} - file_url: {file_url[:100] if file_url else 'EMPTY'}")
    logger.info(f"Job {job_id} - user_id: {user_id}")

    if not file_url or not user_id:
        await _safe_set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "error": "Dados inválidos",
            },
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Dados inválidos")
                await add_job_event(
                    job_uuid=job_uuid,
                    event_type="failed",
                    message="Dados inválidos",
                )
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    client_id = payload.get("client_id")
    store_pdf = bool(payload.get("store_pdf"))
    store_input_pdf = bool(payload.get("store_input_pdf", True))
    expires_in = int(payload.get("signed_url_expires_in") or 600)
    input_document_id = payload.get("input_document_id")

    await _safe_set_job_status(job_id, {"job_id": job_id, "status": "processing", "progress": 10})
    if job_uuid:
        try:
            await mark_job_processing(job_uuid=job_uuid, progress=10)
            await add_job_event(
                job_uuid=job_uuid,
                event_type="processing",
                payload={"progress": 10},
            )
        except Exception:
            logger.exception("Failed to persist job processing in database")

    try:
        callback_base_url = (settings.AI_WORKER_CALLBACK_BASE_URL or "").strip().rstrip("/")
        if not callback_base_url:
            host = "host.docker.internal" if os.path.exists("/.dockerenv") else "127.0.0.1"
            callback_base_url = f"http://{host}:{settings.PORT}"
        callback_url = f"{callback_base_url}/api/v1/ai/jobs/progress"

        # Route to appropriate analysis method based on job_type
        if job_type == "process_summary":
            result = await ai_service.analyze_process_summary(
                file_url=file_url,
                user_id=user_id,
                client_id=str(client_id) if client_id is not None else None,
                store_pdf=store_pdf,
                store_input_pdf=store_input_pdf,
                signed_url_expires_in=expires_in,
                job_id=job_id,
                callback_url=callback_url,
            )
        else:  # cnis_analysis
            result = await ai_service.analyze_cnis(
                file_url=file_url,
                user_id=user_id,
                client_id=str(client_id) if client_id is not None else None,
                store_pdf=store_pdf,
                store_input_pdf=store_input_pdf,
                signed_url_expires_in=expires_in,
                job_id=job_id,
                callback_url=callback_url,
            )
    except Exception as e:
        err = str(getattr(e, "detail", None) or str(e) or "Erro")
        await _safe_set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "progress": 100,
                "error": err,
            },
        )
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error=err)
                await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return

    status: dict = {"job_id": job_id, "status": "completed", "progress": 100}
    result_payload: dict = {}

    input_hash = result.get("input_hash")
    if input_hash:
        result_payload["input_hash"] = input_hash

    audit_score = result.get("audit_score")
    if audit_score is not None:
        status["result"] = {"audit_score": audit_score}
        result_payload["audit_score"] = audit_score

    # Para process_summary, incluir structured_summary
    structured_summary = result.get("structured_summary")
    if structured_summary is not None and isinstance(structured_summary, dict):
        status["result"] = {
            **(status.get("result") or {}),
            "structured_summary": structured_summary,
        }
        result_payload["structured_summary"] = structured_summary

    markdown = result.get("markdown")
    if isinstance(markdown, str) and markdown.strip():
        status["result"] = {
            **(status.get("result") or {}),
            "markdown": markdown,
        }
        result_payload["markdown"] = markdown

    input_doc_id = input_document_id

    if not input_doc_id:
        input_storage = result.get("input_storage")
        if job_uuid and isinstance(input_storage, dict):
            input_bucket = input_storage.get("bucket")
            input_path = input_storage.get("storage_path")
            if isinstance(input_bucket, str) and isinstance(input_path, str):
                filename = input_path.rsplit("/", 1)[-1] if "/" in input_path else input_path
                try:
                    input_doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=str(client_id) if client_id is not None else None,
                        document_type="input",
                        bucket=input_bucket,
                        storage_path=input_path,
                        filename=filename,
                        checksum_sha256=input_hash,
                        size_bytes=None,
                        metadata={"endpoint": job_type},
                    )
                    if input_doc_id:
                        logger.info(f"Input document saved: {input_doc_id}")
                except Exception:
                    logger.exception("Failed to persist input document in database")

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
                    metadata={"endpoint": job_type, "audit_score": audit_score},
                    linked_document_id=input_doc_id,
                )
            except Exception:
                logger.exception("Failed to persist document in database")
                doc_id = None

            # Retornar apenas document_id, não download_url
            # O frontend deve usar GET /api/ai/documents/{document_id}/download para obter URL fresca
            if doc_id:
                status["result"] = {
                    **(status.get("result") or {}),
                    "document_id": str(doc_id),
                }
                result_payload["document_id"] = str(doc_id)
                logger.info(f"Output document saved: {doc_id}")
            else:
                # Fallback: retornar bucket e storage_path se não conseguir criar documento
                status["result"] = {
                    **(status.get("result") or {}),
                    "bucket": bucket,
                    "storage_path": storage_path,
                }
                result_payload["bucket"] = bucket
                result_payload["storage_path"] = storage_path
        else:
            # Sem job_uuid ou informações de storage - retornar PDF em base64
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
                job_uuid=job_uuid,
                event_type="completed",
                payload={"progress": 100},
            )
        except Exception:
            logger.exception("Failed to persist job completion in database")


async def _handle_office_job(job: dict) -> None:
    """Handle Office-related jobs (Google Calendar sync, etc.)."""
    job_id = str(job.get("job_id") or "").strip()
    job_type = str(job.get("type") or "").strip()

    logger.info(f"Processing office job: {job_id} (type: {job_type})")

    # TODO: Implement office job handlers
    # - calendar_sync: Sync events with Google Calendar
    # - calendar_webhook: Process Google Calendar webhook notifications

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

    # AI jobs
    if job_type in ("cnis_analysis", "process_summary"):
        await _handle_ai_job(job)
        return

    # Office jobs
    if job_type.startswith("calendar_") or job_type.startswith("office_"):
        await _handle_office_job(job)
        return

    # Unknown job type
    job_id = str(job.get("job_id") or "").strip()
    if job_id:
        await _safe_set_job_status(
            job_id,
            {
                "job_id": job_id,
                "status": "failed",
                "error": f"Unknown job type: {job_type}",
            },
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
        logger.info(f"Processing job: {job_id} (type: {job_type})")

        try:
            await _handle_job(job)
        except Exception:
            logger.exception(f"Unhandled error processing job: {job_id}")


def main() -> None:
    """Entry point."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
