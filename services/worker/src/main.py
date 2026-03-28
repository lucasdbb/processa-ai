"""Processa AI - Async Job Worker

Processes jobs from a PostgreSQL queue for:
- AI jobs (CNIS analysis, Process Summary)
- Office jobs (Google Calendar sync, etc.)
"""

import asyncio
import hashlib
import json
import os
import signal
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
from src.core.db import close_db, init_db
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.queue import ack_job, dequeue_job, dequeue_translation_job, nack_job, reap_stuck_jobs
from src.core.worker_store import (
    add_worker_job_event,
    create_calculator_document,
    mark_worker_job_completed,
    mark_worker_job_failed,
    mark_worker_job_processing,
)
from src.handlers.ai_service import AiService

ai_service = AiService()

# Graceful shutdown event
_shutdown_event = asyncio.Event()


def _handle_signal(sig, frame):
    """Signal handler for graceful shutdown."""
    logger.info("Received signal %s, initiating graceful shutdown...", sig)
    _shutdown_event.set()


# Costs mapping (must match backend/src/features/billing/credits/constants.py)
JOB_COSTS = {
    "cnis_analysis": 5,
    "process_summary": 5,
    "labor_claim": 5,
    "brief_scanner": 3,
    "audio_transcription": 3,
}


async def _validate_job_basic(job: dict) -> tuple[str, uuid.UUID | None, str, dict] | None:
    """
    Extract and validate basic job info.
    Returns (job_id, job_uuid, job_type, payload) or None if invalid.
    """
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
    if job_type not in ("cnis_analysis", "process_summary", "labor_claim", "brief_scanner", "audio_transcription"):
        if job_uuid:
            try:
                await mark_job_failed(job_uuid=job_uuid, error="Tipo inválido")
                await add_job_event(job_uuid=job_uuid, event_type="failed", message="Tipo inválido")
            except Exception:
                logger.exception("Failed to persist job failure in database")
        return None

    payload = job.get("payload")
    if not isinstance(payload, dict):
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
    is_multi_file = job_type in ("labor_claim", "process_summary")
    file_url = ""
    file_urls = []
    bucket = None
    storage_path = None

    if is_multi_file:
        files_list = payload.get("files") or []
        file_urls = [str(f.get("file_url") or "") for f in files_list if f.get("file_url")]

        # process_summary requires at least one file
        if job_type == "process_summary" and not file_urls:
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

        # Fallback: extract from files list if direct fields are empty
        if not file_url:
            files_list = payload.get("files") or []
            if files_list and isinstance(files_list, list) and len(files_list) > 0:
                first_file = files_list[0]
                file_url = str(first_file.get("file_url") or "").strip()
                if not bucket:
                    bucket = str(first_file.get("bucket") or "").strip()
                if not storage_path:
                    storage_path = str(first_file.get("storage_path") or "").strip()

        # If we have bucket + storage_path but no file_url (or expired),
        # generate a signed URL
        # NOTE: Backend usually sends signed URL in file_url,
        # but if it's missing or we need to refresh:
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
    if job_uuid:
        try:
            await mark_job_processing(job_uuid=job_uuid, progress=5)
            await add_job_event(job_uuid=job_uuid, event_type="processing", payload={"progress": 5})
        except Exception:
            logger.exception("Failed to persist job processing in database")

    # Create progress reporter for real-time updates
    progress = ProgressReporter(job_id=job_id, job_uuid=job_uuid)

    if job_type == "labor_claim":
        return await ai_service.analyze_labor_claim(
            file_urls=file_urls,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            store_input_pdf=True,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )
    elif job_type == "brief_scanner":
        return await ai_service.analyze_brief_scanner(
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
    elif job_type == "process_summary":
        return await ai_service.analyze_process_summary(
            file_urls=file_urls,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=store_pdf,
            store_input_pdf=store_input_pdf,
            signed_url_expires_in=expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )
    elif job_type == "audio_transcription":
        return await ai_service.analyze_audio_transcription(
            file_url=file_url,
            user_id=user_id,
            client_id=str(client_id) if client_id is not None else None,
            store_pdf=False,
            store_input_pdf=False,
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
    if job_uuid:
        try:
            # 1. Mark job as failed in DB
            await mark_job_failed(job_uuid=job_uuid, error=err)
            await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)

            input_document_id = payload.get("input_document_id")
            is_multi_file = job_type in ("labor_claim", "process_summary")
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

    result_payload: dict = {}

    input_hash = result.get("input_hash")
    if input_hash:
        result_payload["input_hash"] = input_hash

    structured_summary = result.get("structured_summary")
    if structured_summary is not None and isinstance(structured_summary, dict):
        result_payload["structured_summary"] = structured_summary

    # Persist Gemini structured JSON (used by CNIS analysis cache)
    structured_data = result.get("structured_data")
    if structured_data is not None and isinstance(structured_data, dict):
        result_payload["structured_data"] = structured_data

    # Persist markdown content (used by audio transcription and other text-only results)
    markdown = result.get("markdown")
    if markdown and isinstance(markdown, str):
        result_payload["markdown"] = markdown

    # Persist token usage and cost
    token_usage = result.get("token_usage")
    if token_usage and isinstance(token_usage, dict):
        result_payload["token_usage"] = token_usage

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
                try:
                    from src.core.storage import StorageService

                    storage = StorageService()
                    download_url = await storage.generate_signed_url(
                        bucket=bucket,
                        storage_path=storage_path,
                        expires_in=3600,
                    )
                    result_payload["download_url"] = download_url
                except Exception as e:
                    logger.warning(f"Failed to generate preview URL for output document: {e}")

                result_payload["document_id"] = str(doc_id)
                logger.info("Output document saved: %s", doc_id)
            else:
                result_payload["bucket"] = bucket
                result_payload["storage_path"] = storage_path

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
    # Note: user_id check is partially done in validation,
    # but logic requires check after files for single-file case?
    # Original code had complex logic for user_id/file_url/is_multi_file checks.
    # Let's replicate exact logic.

    # 2. Prepare Files
    files_result = await _prepare_files(job_id, job_uuid, job_type, payload)
    if not files_result:
        return
    file_url, file_urls, bucket, storage_path = files_result

    # Additional validation logic from original code
    is_multi_file = job_type in ("labor_claim", "process_summary")
    if not is_multi_file and (not file_url or not user_id):
        logger.info("is_multi_file: %s", is_multi_file)
        logger.info("file_url: %s", file_url)
        logger.info("user_id: %s", user_id)

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


async def _handle_calculator_job(job: dict) -> None:
    """Handle calculator PDF generation jobs (rescisao, aposentadoria).

    Unlike AI jobs, calculator jobs don't need file download, OCR, or LLM.
    The input/output payloads are already computed and included in the job payload.
    """
    job_id = str(job.get("job_id") or "").strip()
    job_type = str(job.get("type") or "").strip()
    payload = job.get("payload")
    if not isinstance(payload, dict):
        return

    job_uuid: uuid.UUID | None = None
    raw_uuid = (job.get("job_uuid") or "").strip() if isinstance(job.get("job_uuid"), str) else None
    if raw_uuid:
        try:
            job_uuid = uuid.UUID(raw_uuid)
        except Exception:
            pass
    if job_uuid is None:
        job_uuid = parse_job_uuid(job_id)

    user_id = str(payload.get("user_id") or "").strip()
    client_id = payload.get("client_id")
    calculation_id_str = str(payload.get("calculation_id") or "").strip()
    input_payload = payload.get("input_payload") or {}
    output_payload = payload.get("output_payload") or {}
    calculator_key = str(payload.get("calculator_key") or "").strip()

    if not user_id:
        if job_uuid:
            try:
                await mark_worker_job_failed(job_uuid=job_uuid, error="user_id obrigatório")
            except Exception:
                pass
        return

    # Mark as processing
    if job_uuid:
        try:
            await mark_worker_job_processing(job_uuid=job_uuid, progress=10)
            await add_worker_job_event(
                job_uuid=job_uuid, event_type="processing", payload={"progress": 10}
            )
        except Exception:
            logger.exception("Failed to persist job processing in database")

    try:
        # Generate PDF
        if job_type == "calculator_rescisao":
            from src.handlers.reports.rescisao import generate_rescisao_pdf_from_template

            pdf_bytes = generate_rescisao_pdf_from_template(
                input_payload=input_payload, output_payload=output_payload
            )
        elif job_type == "calculator_aposentadoria":
            # Aposentadoria uses markdown-to-PDF (no docx template yet)
            md = _render_aposentadoria_markdown(
                input_payload=input_payload, output_payload=output_payload
            )
            pdf_bytes = ai_service._markdown_to_pdf_bytes(md, title="Simulação de Aposentadoria")
        else:
            raise RuntimeError(f"Tipo de calculadora desconhecido: {job_type}")

        if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise RuntimeError("Falha ao gerar PDF do relatório")

        # Upload to Supabase Storage
        from src.core.storage import StorageService

        storage = StorageService()
        job_uuid_str = str(job_uuid) if job_uuid else job_id
        filename = f"{job_type}_{calculation_id_str or job_uuid_str}.pdf"
        uploaded = await storage.upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=str(client_id) if client_id else None,
            functionality="calculators",
            job_uuid=job_uuid_str,
            filename=filename,
            expires_in=3600,
            output=True,
        )

        bucket = uploaded.get("bucket", "documents")
        storage_path = uploaded.get("storage_path", "")
        download_url = uploaded.get("signed_url") or uploaded.get("download_url") or ""

        # Create document record
        doc_id = None
        if job_uuid and bucket and storage_path:
            checksum = hashlib.sha256(pdf_bytes).hexdigest()
            size_bytes = len(pdf_bytes)

            calc_uuid = None
            if calculation_id_str:
                try:
                    calc_uuid = uuid.UUID(calculation_id_str)
                except Exception:
                    pass

            try:
                if calc_uuid:
                    doc_id = await create_calculator_document(
                        worker_job_id=job_uuid,
                        calculation_id=calc_uuid,
                        user_id=user_id,
                        client_id=str(client_id) if client_id else None,
                        document_type=f"{job_type}_pdf",
                        bucket=bucket,
                        storage_path=storage_path,
                        filename=filename,
                        checksum_sha256=checksum,
                        size_bytes=size_bytes,
                        metadata={"calculator_key": calculator_key},
                    )
                else:
                    doc_id = await create_calculator_document(
                        worker_job_id=job_uuid,
                        user_id=user_id,
                        client_id=str(client_id) if client_id else None,
                        document_type=f"{job_type}_pdf",
                        bucket=bucket,
                        storage_path=storage_path,
                        filename=filename,
                        checksum_sha256=checksum,
                        size_bytes=size_bytes,
                        metadata={"calculator_key": calculator_key},
                    )
            except Exception:
                logger.exception("Failed to persist calculator document in database")

        # Mark completed
        result_payload: dict = {}
        status_result: dict = {}
        if doc_id:
            result_payload["document_id"] = str(doc_id)
            status_result["document_id"] = str(doc_id)
        if download_url:
            result_payload["download_url"] = download_url
            status_result["download_url"] = download_url

        if job_uuid:
            try:
                await mark_worker_job_completed(job_uuid=job_uuid, result_payload=result_payload)
                await add_worker_job_event(
                    job_uuid=job_uuid, event_type="completed", payload={"progress": 100}
                )
            except Exception:
                logger.exception("Failed to persist calculator job completion")

    except Exception as e:
        err = str(getattr(e, "detail", None) or str(e) or "Erro ao gerar PDF")
        logger.exception("Calculator job failed: %s", err)
        if job_uuid:
            try:
                await mark_worker_job_failed(job_uuid=job_uuid, error=err)
                await add_worker_job_event(job_uuid=job_uuid, event_type="failed", message=err)
            except Exception:
                logger.exception("Failed to persist calculator job failure")


def _render_aposentadoria_markdown(*, input_payload: dict, output_payload: dict) -> str:
    """Render aposentadoria result as markdown for PDF generation."""
    detalhes = (output_payload.get("detalhes") if isinstance(output_payload, dict) else None) or {}

    def money(v: object) -> str:
        try:
            return f"R$ {float(v):.2f}"
        except Exception:
            return "-"

    lines: list[str] = []
    lines.append("# Simulação de Aposentadoria")
    lines.append("")
    lines.append("## Parâmetros")
    lines.append("")
    lines.append(f"- Sexo: {input_payload.get('sexo', '').capitalize()}")
    lines.append(f"- Idade atual: {input_payload.get('idade')} anos")
    lines.append(f"- Tempo de contribuição: {input_payload.get('tempo_contribuicao')} anos")
    lines.append(f"- Salário de contribuição: {money(input_payload.get('salario_contribuicao'))}")
    lines.append("")
    lines.append("## Resultado")
    lines.append("")

    pode = detalhes.get("pode_aposentar")
    status_text = (
        "APROVADO - Requisitos atendidos" if pode else "PENDENTE - Requisitos não atendidos"
    )

    lines.append(f"**Status: {status_text}**")
    lines.append("")

    if pode:
        lines.append(f"### Valor Estimado do Benefício: {money(detalhes.get('beneficio'))}")
        lines.append("")
        lines.append("> Nota: Este valor é uma estimativa baseada nas regras gerais.")
        lines.append(
            "> O valor real depende do cálculo da média de todos os salários de contribuição."
        )
    else:
        lines.append("### O que falta:")
        lines.append("")
        lines.append(
            f"- Idade mínima exigida: {detalhes.get('idade_minima')} anos "
            f"(Faltam {detalhes.get('anos_restantes')} anos)"
        )
        lines.append(
            f"- Tempo de contribuição mínimo: {detalhes.get('tempo_minimo_contrib')} anos "
            f"(Faltam {detalhes.get('tempo_restante')} anos)"
        )

    lines.append("")
    lines.append("---")
    lines.append("Este relatório é uma simulação e não possui valor legal.")
    lines.append("Consulte um advogado previdenciário.")

    return "\n".join(lines)


async def _handle_office_job(job: dict) -> None:
    """Handle Office-related jobs (Google Calendar sync, etc.)."""
    job_id = str(job.get("job_id") or "").strip()
    job_type = str(job.get("type") or "").strip()

    logger.info("Processing office job: %s (type: %s)", job_id, job_type)
    logger.warning("Office job type '%s' not implemented yet", job_type)


async def _handle_rag_ingest_job(job: dict) -> None:
    """Handle RAG document ingestion jobs."""
    from src.handlers.rag_ingest import handle_rag_ingest

    job_id = str(job.get("job_id") or "").strip()
    logger.info("Processing RAG ingest job: %s", job_id)

    try:
        await handle_rag_ingest(job)
    except Exception:
        logger.exception("RAG ingest job failed: %s", job_id)


async def _handle_job(job: dict) -> None:
    """Route job to appropriate handler based on job type."""
    job_type = str(job.get("type") or "").strip()

    if job_type in ("cnis_analysis", "process_summary", "labor_claim", "brief_scanner", "audio_transcription"):
        await _handle_ai_job(job)
        return

    if job_type == "rag_ingest":
        await _handle_rag_ingest_job(job)
        return

    if job_type in ("calculator_rescisao", "calculator_aposentadoria"):
        await _handle_calculator_job(job)
        return

    if job_type.startswith("calendar_") or job_type.startswith("office_"):
        await _handle_office_job(job)
        return

    logger.warning("Unknown job type: %s", job_type)


async def _run_ai_worker() -> None:
    """Main loop for AI/calculator/office jobs."""
    logger.info("Processa AI Worker started - waiting for jobs...")

    while not _shutdown_event.is_set():
        queue_id, job = await dequeue_job()
        if not job or queue_id is None:
            await asyncio.sleep(settings.POLL_INTERVAL_S)
            continue

        job_id = job.get("job_id", "unknown")
        job_type = job.get("type", "unknown")
        logger.info("Processing job: %s (type: %s, queue_id: %s)", job_id, job_type, queue_id)

        try:
            await asyncio.wait_for(_handle_job(job), timeout=600)
            # Job processed successfully — remove from queue
            await ack_job(queue_id)
            logger.info("Job %s completed and acknowledged", job_id)
        except asyncio.TimeoutError:
            logger.error("Job %s timed out after 600 seconds", job_id)
            # Return to queue for retry via nack
            await nack_job(queue_id)
            try:
                job_uuid = parse_job_uuid(job_id)
                if job_uuid:
                    await mark_job_failed(job_uuid, "Job timed out after 10 minutes")
            except Exception:
                logger.exception("Failed to mark timed-out job %s as failed", job_id)
        except Exception:
            logger.exception("Unhandled error processing job: %s", job_id)
            # Return to queue for retry via nack
            await nack_job(queue_id)

    logger.info("AI Worker loop stopped (shutdown requested)")


async def _run_translation_worker() -> None:
    """Dedicated loop for fast translation jobs (separate from heavy AI jobs)."""
    from src.handlers.translate_timeline import handle_translate_timeline_event

    logger.info("Translation Worker started - waiting for translation jobs...")

    while not _shutdown_event.is_set():
        queue_id, job = await dequeue_translation_job()
        if not job or queue_id is None:
            await asyncio.sleep(settings.TRANSLATION_POLL_INTERVAL_S)
            continue

        job_type = job.get("job_type", "unknown")
        event_id = job.get("timeline_event_id", "unknown")
        logger.info("Processing translation job: event=%s (type: %s)", event_id, job_type)

        try:
            if job_type == "translate_timeline_event":
                await asyncio.wait_for(handle_translate_timeline_event(job), timeout=60)
            else:
                logger.warning("Unknown translation job type: %s", job_type)
            await ack_job(queue_id)
        except asyncio.TimeoutError:
            logger.error("Translation job timed out after 60s: event=%s", event_id)
            await nack_job(queue_id)
        except Exception:
            logger.exception("Unhandled error processing translation job: event=%s", event_id)
            await nack_job(queue_id)


async def _run_reaper() -> None:
    """Periodically re-enqueue jobs stuck in 'processing' state.

    Runs every 60 seconds. Jobs stuck longer than VISIBILITY_TIMEOUT_S
    are returned to 'pending'. Jobs exceeding MAX_RETRIES go to 'dead'.
    """
    logger.info("Reaper started - monitoring for stuck jobs...")

    while not _shutdown_event.is_set():
        # Wait 60s between reaper runs, but check shutdown every second
        for _ in range(60):
            if _shutdown_event.is_set():
                break
            await asyncio.sleep(1)

        if _shutdown_event.is_set():
            break

        try:
            reaped = await reap_stuck_jobs()
            if reaped > 0:
                logger.info("Reaper re-enqueued %d stuck jobs", reaped)
        except Exception:
            logger.exception("Reaper failed to check for stuck jobs")

    logger.info("Reaper stopped (shutdown requested)")


async def _run_health_server() -> None:
    """HTTP health check server with DB connectivity and queue status."""

    async def _build_health_response() -> tuple[int, str]:
        """Build health check response with DB and queue info."""
        from src.core.db import get_pool

        health: dict = {"service": "worker"}

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    # Check DB connectivity
                    await cur.execute("SELECT 1")

                    # Get queue stats
                    await cur.execute(
                        "SELECT status, COUNT(*) AS cnt FROM job_queue GROUP BY status"
                    )
                    rows = await cur.fetchall()
                    queue_stats = {row[0]: row[1] for row in rows}

                    health["status"] = "healthy"
                    health["db"] = "connected"
                    health["queue"] = {
                        "pending": queue_stats.get("pending", 0),
                        "processing": queue_stats.get("processing", 0),
                        "dead": queue_stats.get("dead", 0),
                    }
            return 200, json.dumps(health)
        except Exception as e:
            health["status"] = "degraded"
            health["db"] = f"error: {e}"
            return 503, json.dumps(health)

    async def handle_client(reader, writer):
        try:
            await reader.read(1024)
            status_code, body = await _build_health_response()
            status_text = "OK" if status_code == 200 else "Service Unavailable"
            response = (
                f"HTTP/1.1 {status_code} {status_text}\r\n"
                "Content-Type: application/json\r\n"
                f"Content-Length: {len(body)}\r\n"
                "\r\n"
                f"{body}"
            )
            writer.write(response.encode())
            await writer.drain()
        finally:
            writer.close()

    port = int(os.environ.get("PORT", 8001))
    server = await asyncio.start_server(handle_client, "0.0.0.0", port)
    logger.info("Health check server started on port %d", port)

    async with server:
        await _shutdown_event.wait()

    logger.info("Health check server stopped")


async def run_worker() -> None:
    """Entry point: initializes DB and runs both worker loops concurrently."""
    # Validate configuration
    settings.validate()

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Initialize database — fail fast if it's unreachable
    try:
        await init_db()
    except Exception:
        logger.exception("Failed to initialize database — cannot proceed")
        raise

    results = await asyncio.gather(
        _run_ai_worker(),
        _run_translation_worker(),
        _run_reaper(),
        _run_health_server(),
        return_exceptions=True,
    )

    # Log any unexpected exceptions from worker loops
    loop_names = ["AI Worker", "Translation Worker", "Reaper", "Health Server"]
    for name, result in zip(loop_names, results):
        if isinstance(result, Exception):
            logger.error("%s crashed with exception: %s", name, result, exc_info=result)

    # Gracefully close database connection pool
    await close_db()


def main() -> None:
    """Entry point."""
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
