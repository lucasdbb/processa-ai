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
from src.features.ai.service import AiService

service = AiService()


def _encode_bytes(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")


async def _safe_set_job_status(job_id: str, status_payload: dict) -> None:
    try:
        await set_job_status(job_id, status_payload)
    except Exception:
        logger.exception("Failed to persist job status in Redis")


async def _handle_job(job: dict) -> None:
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
    if job_type != "cnis_analysis":
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
    user_id = str(payload.get("user_id") or "").strip()
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
    expires_in = int(payload.get("signed_url_expires_in") or 600)

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
        # Gerar callback_url para n8n fazer updates de progresso
        # Usar 127.0.0.1 explícito ao invés de localhost para evitar problemas com IPv6
        callback_base_url = (settings.AI_WORKER_CALLBACK_BASE_URL or "").strip().rstrip("/")
        if not callback_base_url:
            host = "host.docker.internal" if os.path.exists("/.dockerenv") else "127.0.0.1"
            callback_base_url = f"http://{host}:{settings.PORT}"
        callback_url = f"{callback_base_url}/api/v1/ai/jobs/progress"

        result = await service.analyze_cnis(
            file_url=file_url,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
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

    # Salvar input_hash para cache funcionar
    input_hash = result.get("input_hash")
    if input_hash:
        result_payload["input_hash"] = input_hash

    audit_score = result.get("audit_score")
    if audit_score is not None:
        status["result"] = {"audit_score": audit_score}
        result_payload["audit_score"] = audit_score

    markdown = result.get("markdown")
    if isinstance(markdown, str) and markdown.strip():
        status["result"] = {
            **(status.get("result") or {}),
            "markdown": markdown,
        }
        result_payload["markdown"] = markdown

    if store_pdf:
        status["result"] = {
            **(status.get("result") or {}),
            "bucket": result.get("bucket"),
            "storage_path": result.get("storage_path"),
            "download_url": result.get("download_url"),
        }

        bucket = result.get("bucket")
        storage_path = result.get("storage_path")
        pdf_bytes = result.get("content")
        if isinstance(pdf_bytes, (bytes, bytearray)):
            status["result"]["content"] = _encode_bytes(bytes(pdf_bytes))
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
                    document_type="cnis_analysis_pdf",
                    bucket=bucket,
                    storage_path=storage_path,
                    filename=filename,
                    checksum_sha256=checksum,
                    size_bytes=size_bytes,
                    metadata={"endpoint": "cnis_analysis", "audit_score": audit_score},
                )
            except Exception:
                logger.exception("Failed to persist document in database")
                doc_id = None
            if doc_id:
                status["result"]["document_id"] = str(doc_id)
                result_payload["document_id"] = str(doc_id)

        if isinstance(bucket, str):
            result_payload["bucket"] = bucket
        if isinstance(storage_path, str):
            result_payload["storage_path"] = storage_path
        download_url = result.get("download_url")
        if isinstance(download_url, str):
            result_payload["download_url"] = download_url
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


async def run_worker() -> None:
    try:
        await init_db()
    except Exception:
        logger.exception("Failed to initialize database")
    logger.info("AI Worker background consumer started")
    while True:
        job = await dequeue_job(timeout_s=5)
        if not job:
            continue
        await _handle_job(job)


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
