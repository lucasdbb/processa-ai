"""Processa AI - Async Job Worker

Processes jobs from a PostgreSQL queue for:
- AI jobs (CNIS analysis, Process Summary)
- Office jobs (Google Calendar sync, etc.)

Jobs are dequeued directly from the unified public.jobs table
via FOR UPDATE SKIP LOCKED. No separate job_queue table is used.
"""

import asyncio
import hashlib
import json
import os
import signal
import uuid

from src.core.job_store import (
    add_job_event,
    create_document,
    mark_calculation_completed,
    mark_calculation_failed,
    mark_job_completed,
    mark_job_failed,
    mark_job_processing,
    parse_job_uuid,
    update_job_progress,
)
from src.core.config import settings
from src.core.db import close_db, init_db
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.queue import dequeue_job, dequeue_translation_job, nack_job, reap_stuck_jobs
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


async def _validate_job_basic(job_row: dict) -> tuple[uuid.UUID, str, dict] | None:
    """
    Extract and validate basic job info from the unified jobs row.
    Returns (job_uuid, job_type, request_payload) or None if invalid.
    """
    job_uuid = job_row.get("id")
    if not job_uuid:
        return None

    if not isinstance(job_uuid, uuid.UUID):
        try:
            job_uuid = uuid.UUID(str(job_uuid))
        except Exception:
            return None

    job_type = str(job_row.get("job_type") or "").strip()
    if job_type not in (
        "cnis_analysis",
        "process_summary",
        "labor_claim",
        "brief_scanner",
        "audio_transcription",
    ):
        try:
            await mark_job_failed(job_uuid=job_uuid, error="Tipo inválido")
            await add_job_event(job_uuid=job_uuid, event_type="failed", message="Tipo inválido")
        except Exception:
            logger.exception("Failed to persist job failure in database")
        return None

    payload = job_row.get("request_payload")
    if not isinstance(payload, dict):
        try:
            await mark_job_failed(job_uuid=job_uuid, error="Payload inválido")
            await add_job_event(
                job_uuid=job_uuid, event_type="failed", message="Payload inválido"
            )
        except Exception:
            logger.exception("Failed to persist job failure in database")
        return None

    return job_uuid, job_type, payload


async def _prepare_files(
    job_uuid: uuid.UUID, job_type: str, payload: dict
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

        # If we have bucket + storage_path but no file_url, generate a signed URL
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

    return file_url, file_urls, bucket, storage_path


async def _execute_ai_service(
    job_type: str,
    job_uuid: uuid.UUID,
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
    job_id = str(job_uuid)

    # Mark as processing
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
    job_uuid: uuid.UUID,
    job_type: str,
    user_id: str,
    payload: dict,
    bucket: str | None,
    storage_path: str | None,
) -> None:
    """Handle job failure, cleanup files, and refund credits."""
    err = str(getattr(e, "detail", None) or str(e) or "Erro")
    try:
        # 1. Mark job as failed in DB
        await mark_job_failed(job_uuid=job_uuid, error=err)
        await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)

        input_document_id = payload.get("input_document_id")
        is_multi_file = job_type in ("labor_claim", "process_summary")
        files_list = payload.get("files") or []

        # 2. Cleanup file from bucket if not saved in DB
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
            await ai_service.refund_credits(user_id, cost, reason=f"refund_{job_type}_{job_uuid}")

    except Exception:
        logger.exception("Failed to persist job failure or refund credits")


async def _save_results(
    result: dict, job_uuid: uuid.UUID, job_type: str, payload: dict
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

    input_doc_id = input_document_id

    if store_pdf:
        bucket = result.get("bucket")
        storage_path = result.get("storage_path")
        pdf_bytes = result.get("content")

        if isinstance(bucket, str) and isinstance(storage_path, str):
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

    try:
        await mark_job_completed(job_uuid=job_uuid, result_payload=result_payload)
        await add_job_event(
            job_uuid=job_uuid, event_type="completed", payload={"progress": 100}
        )
    except Exception:
        logger.exception("Failed to persist job completion in database")


async def _handle_ai_job(job_row: dict) -> None:
    """Handle AI-related jobs (CNIS analysis, Process Summary)."""
    # 1. Validation
    validation_result = await _validate_job_basic(job_row)
    if not validation_result:
        return
    job_uuid, job_type, payload = validation_result

    user_id = str(payload.get("user_id") or "").strip()

    # 2. Prepare Files
    files_result = await _prepare_files(job_uuid, job_type, payload)
    if not files_result:
        return
    file_url, file_urls, bucket, storage_path = files_result

    # Additional validation logic
    is_multi_file = job_type in ("labor_claim", "process_summary")
    if not is_multi_file and (not file_url or not user_id):
        logger.info("is_multi_file: %s", is_multi_file)
        logger.info("file_url: %s", file_url)
        logger.info("user_id: %s", user_id)

        try:
            await mark_job_failed(job_uuid=job_uuid, error="Dados inválidos")
            await add_job_event(
                job_uuid=job_uuid, event_type="failed", message="Dados inválidos"
            )
        except Exception:
            logger.exception("Failed to persist job failure in database")
        return

    if not user_id:
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
        result = await _execute_ai_service(job_type, job_uuid, payload, file_url, file_urls)
    except Exception as e:
        await _handle_failure(e, job_uuid, job_type, user_id, payload, bucket, storage_path)
        return

    # 4. Save Results
    await _save_results(result, job_uuid, job_type, payload)


async def _handle_calculator_job(job_row: dict) -> None:
    """Handle calculator PDF generation jobs (rescisao, aposentadoria).

    Unlike AI jobs, calculator jobs don't need file download, OCR, or LLM.
    The input/output payloads are already computed and included in the job payload.
    """
    job_uuid = job_row.get("id")
    job_type = str(job_row.get("job_type") or "").strip()
    payload = job_row.get("request_payload")
    if not isinstance(payload, dict):
        return

    if not isinstance(job_uuid, uuid.UUID):
        try:
            job_uuid = uuid.UUID(str(job_uuid))
        except Exception:
            return

    user_id = str(payload.get("user_id") or "").strip()
    client_id = payload.get("client_id")
    calculation_id_str = str(payload.get("calculation_id") or "").strip()
    input_payload = payload.get("input_payload") or {}
    output_payload = payload.get("output_payload") or {}
    calculator_key = str(payload.get("calculator_key") or "").strip()

    if not user_id:
        try:
            await mark_job_failed(job_uuid=job_uuid, error="user_id obrigatório")
        except Exception:
            pass
        return

    # Mark as processing
    try:
        await mark_job_processing(job_uuid=job_uuid, progress=10)
        await add_job_event(
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
        else:
            raise RuntimeError(f"Tipo de calculadora desconhecido: {job_type}")

        if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise RuntimeError("Falha ao gerar PDF do relatório")

        # Upload to Supabase Storage
        from src.core.storage import StorageService

        storage = StorageService()
        job_uuid_str = str(job_uuid)
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
        if bucket and storage_path:
            checksum = hashlib.sha256(pdf_bytes).hexdigest()
            size_bytes = len(pdf_bytes)

            calc_uuid = None
            if calculation_id_str:
                try:
                    calc_uuid = uuid.UUID(calculation_id_str)
                except Exception:
                    pass

            try:
                doc_id = await create_document(
                    job_uuid=job_uuid,
                    user_id=user_id,
                    client_id=str(client_id) if client_id else None,
                    document_type=f"{job_type}_pdf",
                    bucket=bucket,
                    storage_path=storage_path,
                    filename=filename,
                    checksum_sha256=checksum,
                    size_bytes=size_bytes,
                    metadata={"calculator_key": calculator_key},
                    source="calculator",
                    calculation_id=calc_uuid,
                )
            except Exception:
                logger.exception("Failed to persist calculator document in database")

        # Mark completed
        result_payload: dict = {}
        if doc_id:
            result_payload["document_id"] = str(doc_id)
        if download_url:
            result_payload["download_url"] = download_url

        try:
            await mark_job_completed(job_uuid=job_uuid, result_payload=result_payload)
            await add_job_event(
                job_uuid=job_uuid, event_type="completed", payload={"progress": 100}
            )
        except Exception:
            logger.exception("Failed to persist calculator job completion")

    except Exception as e:
        err = str(getattr(e, "detail", None) or str(e) or "Erro ao gerar PDF")
        logger.exception("Calculator job failed: %s", err)
        try:
            await mark_job_failed(job_uuid=job_uuid, error=err)
            await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)
        except Exception:
            logger.exception("Failed to persist calculator job failure")


async def _handle_office_job(job_row: dict) -> None:
    """Handle Office-related jobs (Google Calendar sync, etc.)."""
    job_uuid = job_row.get("id")
    job_type = str(job_row.get("job_type") or "").strip()

    logger.info("Processing office job: %s (type: %s)", job_uuid, job_type)
    logger.warning("Office job type '%s' not implemented yet", job_type)


async def _handle_rag_ingest_job(job_row: dict) -> None:
    """Handle RAG document ingestion jobs."""
    from src.handlers.rag_ingest import handle_rag_ingest

    job_uuid = job_row.get("id")
    logger.info("Processing RAG ingest job: %s", job_uuid)

    # Build legacy-compatible dict for rag_ingest handler
    payload = job_row.get("request_payload") or {}
    job = {
        "job_id": str(job_uuid),
        "job_uuid": str(job_uuid),
        "type": job_row.get("job_type"),
        "payload": payload,
    }

    try:
        await handle_rag_ingest(job)
    except Exception:
        logger.exception("RAG ingest job failed: %s", job_uuid)


async def _handle_previdencia_job(job_row: dict) -> None:
    """Handle previdência calculator jobs (parse_cnis, tempo, media, aposentadoria_simulacao).

    Diferente dos calculator jobs tradicionais, estes fazem o cálculo no worker
    (não recebem output_payload pronto).
    """
    job_uuid = job_row.get("id")
    job_type = str(job_row.get("job_type") or "").strip()
    payload = job_row.get("request_payload")
    if not isinstance(payload, dict):
        return

    if not isinstance(job_uuid, uuid.UUID):
        try:
            job_uuid = uuid.UUID(str(job_uuid))
        except Exception:
            return

    user_id = str(payload.get("user_id") or "").strip()
    client_id = payload.get("client_id")
    calculation_id_str = str(payload.get("calculation_id") or "").strip()

    try:
        await mark_job_processing(job_uuid=job_uuid, progress=10)
        await add_job_event(
            job_uuid=job_uuid, event_type="processing", payload={"progress": 10}
        )
    except Exception:
        logger.exception("Failed to mark previdencia job processing")

    try:
        result_payload: dict = {}

        if job_type == "parse_cnis":
            result_payload = await _handle_parse_cnis(payload, job_uuid)

        elif job_type == "calculator_tempo_contribuicao":
            result_payload = await _handle_calc_tempo_contribuicao(payload, job_uuid)

        elif job_type == "calculator_media_salarial":
            result_payload = await _handle_calc_media_salarial(payload, job_uuid)

        elif job_type == "calculator_aposentadoria_simulacao":
            result_payload = await _handle_calc_aposentadoria_simulacao(
                payload, job_uuid, user_id, client_id, calculation_id_str
            )

        # Mark completed
        try:
            await mark_job_completed(job_uuid=job_uuid, result_payload=result_payload)
            await add_job_event(
                job_uuid=job_uuid, event_type="completed", payload={"progress": 100}
            )
        except Exception:
            logger.exception("Failed to mark previdencia job completed")

        # Update calculation status
        if calculation_id_str:
            try:
                calc_uuid = uuid.UUID(calculation_id_str)
                await mark_calculation_completed(
                    calculation_id=calc_uuid, output_payload=result_payload
                )
            except Exception:
                logger.warning("Could not update calculation status for %s", calculation_id_str)

    except Exception as e:
        err = str(getattr(e, "detail", None) or str(e) or "Erro no cálculo previdenciário")
        logger.exception("Previdencia job failed: %s", err)
        try:
            await mark_job_failed(job_uuid=job_uuid, error=err)
            await add_job_event(job_uuid=job_uuid, event_type="failed", message=err)
        except Exception:
            logger.exception("Failed to persist previdencia job failure")

        # Also fail the calculation
        if calculation_id_str:
            try:
                calc_uuid = uuid.UUID(calculation_id_str)
                await mark_calculation_failed(calculation_id=calc_uuid, error=err)
            except Exception:
                pass


async def _handle_parse_cnis(payload: dict, job_uuid: uuid.UUID | None) -> dict:
    """Parse CNIS PDF using pymupdf (deterministic, no AI)."""
    from src.core.storage import StorageService
    from src.handlers.previdencia.cnis_parser import parse_cnis_pdf

    storage = StorageService()

    file_url = str(payload.get("file_url") or "").strip()
    bucket = str(payload.get("bucket") or "").strip()
    storage_path = str(payload.get("storage_path") or "").strip()

    if bucket and storage_path and not file_url.startswith("http"):
        try:
            file_url = await storage.generate_signed_url(
                bucket=bucket, storage_path=storage_path, expires_in=3600
            )
            logger.info("Generated signed URL successfully for bucket=%s path=%s", bucket, storage_path)
        except Exception as e:
            logger.error("Failed to generate signed URL for CNIS: %s", e, exc_info=True)

    if not file_url:
        raise ValueError("file_url ou (bucket e storage_path) obrigatório para parsing do CNIS")

    if job_uuid:
        await add_job_event(
            job_uuid=job_uuid,
            event_type="processing",
            payload={"progress": 20, "step": "downloading"},
        )

    pdf_bytes = await storage.download_pdf_bytes(file_url)

    if job_uuid:
        await add_job_event(
            job_uuid=job_uuid, event_type="processing", payload={"progress": 50, "step": "parsing"}
        )

    resultado = parse_cnis_pdf(pdf_bytes)

    # Serializar para JSON
    return {
        "segurado": {
            "nome": resultado.segurado.nome,
            "cpf": resultado.segurado.cpf,
            "nit": resultado.segurado.nit,
            "data_nascimento": resultado.segurado.data_nascimento.isoformat()
            if resultado.segurado.data_nascimento
            else None,
            "nome_mae": resultado.segurado.nome_mae,
        },
        "vinculos": [
            {
                "sequencia": v.sequencia,
                "empresa": v.empresa,
                "cnpj": v.cnpj,
                "tipo": v.tipo,
                "data_inicio": v.data_inicio.isoformat() if v.data_inicio else None,
                "data_fim": v.data_fim.isoformat() if v.data_fim else None,
                "ultima_remuneracao": float(v.ultima_remuneracao) if v.ultima_remuneracao else None,
                "indicadores": v.indicadores,
                "remuneracoes": [
                    {
                        "competencia": r.competencia.isoformat(),
                        "valor": float(r.valor),
                        "indicadores": r.indicadores,
                    }
                    for r in v.remuneracoes
                ],
            }
            for v in resultado.vinculos
        ],
        "alertas": resultado.alertas,
    }


async def _handle_calc_tempo_contribuicao(payload: dict, job_uuid: uuid.UUID | None) -> dict:
    """Calcular tempo de contribuição a partir de vínculos."""
    from datetime import date as date_type

    from src.handlers.previdencia.tempo_contribuicao import calcular_tempo_contribuicao
    from src.handlers.previdencia.tipos import TipoVinculo, Vinculo

    vinculos_raw = payload.get("vinculos") or []
    vinculos = []
    for v in vinculos_raw:
        vinculos.append(
            Vinculo(
                data_inicio=date_type.fromisoformat(v["data_inicio"]),
                data_fim=date_type.fromisoformat(v["data_fim"]) if v.get("data_fim") else None,
                empresa=v.get("empresa"),
                cnpj=v.get("cnpj"),
                tipo_vinculo=TipoVinculo(v.get("tipo_vinculo", "Empregado")),
                atividade_especial=v.get("atividade_especial", False),
            )
        )

    resultado = calcular_tempo_contribuicao(vinculos)

    return {
        "detalhes": {
            "anos": resultado.anos,
            "meses": resultado.meses,
            "dias": resultado.dias,
            "total_dias": resultado.total_dias,
            "vinculos_processados": resultado.vinculos_processados,
            "alertas": resultado.alertas,
        }
    }


async def _handle_calc_media_salarial(payload: dict, job_uuid: uuid.UUID | None) -> dict:
    """Calcular média salarial a partir de remunerações."""
    from datetime import date as date_type
    from decimal import Decimal

    from src.handlers.previdencia.media_salarial import calcular_media_salarial
    from src.handlers.previdencia.tipos import Remuneracao

    remuneracoes_raw = payload.get("remuneracoes") or []
    remuneracoes = [
        Remuneracao(
            competencia=date_type.fromisoformat(r["competencia"]),
            valor=Decimal(str(r["valor"])),
        )
        for r in remuneracoes_raw
    ]

    # Buscar índices INPC e teto do banco
    indices_inpc = await _buscar_indices_inpc()
    teto, piso = await _buscar_teto_piso()

    resultado = calcular_media_salarial(
        remuneracoes, indices_inpc=indices_inpc, teto_atual=teto, piso_atual=piso
    )

    return {
        "detalhes": {
            "media_100": float(resultado.media_100),
            "media_80": float(resultado.media_80),
            "qtd_contribuicoes": resultado.qtd_contribuicoes,
            "maior_contribuicao": float(resultado.maior_contribuicao),
            "menor_contribuicao": float(resultado.menor_contribuicao),
        }
    }


def _serializar_cenario_projetado(c) -> dict | None:
    """Serializa um CenarioProjetado para JSON."""
    if c is None:
        return None
    return {
        "regra": c.regra.value,
        "regra_nome": c.regra_nome,
        "meses_restantes": c.meses_restantes,
        "data_elegibilidade": c.data_elegibilidade.isoformat(),
        "tempo_contribuicao_projetado": c.tempo_contribuicao_projetado,
        "coeficiente_projetado": c.coeficiente_projetado,
        "beneficio_projetado": float(c.beneficio_projetado) if c.beneficio_projetado else None,
    }


def _serializar_projecao(projecao) -> dict:
    """Serializa ProjecaoFutura para JSON."""
    return {
        "salario_contribuicao": float(projecao.salario_contribuicao),
        "cenario_mais_proximo": _serializar_cenario_projetado(projecao.cenario_mais_proximo),
        "cenario_mais_vantajoso": _serializar_cenario_projetado(projecao.cenario_mais_vantajoso),
        "ganho_mensal_esperar": float(projecao.ganho_mensal_esperar)
        if projecao.ganho_mensal_esperar
        else None,
        "recomendacao": projecao.recomendacao,
    }


async def _handle_calc_aposentadoria_simulacao(
    payload: dict,
    job_uuid: uuid.UUID | None,
    user_id: str,
    client_id: str | None,
    calculation_id_str: str,
) -> dict:
    """Simulação completa de aposentadoria (6 cenários)."""
    from datetime import date as date_type
    from decimal import Decimal

    from src.handlers.previdencia.engine import simular_aposentadoria
    from src.handlers.previdencia.tipos import (
        DadosSegurado,
        Remuneracao,
        Sexo,
        TipoVinculo,
        Vinculo,
    )

    seg_raw = payload.get("segurado") or {}
    vinculos_raw = payload.get("vinculos") or []
    remuneracoes_raw = payload.get("remuneracoes") or []

    segurado = DadosSegurado(
        data_nascimento=date_type.fromisoformat(seg_raw["data_nascimento"]),
        sexo=Sexo(seg_raw["sexo"]),
        nome=seg_raw.get("nome"),
        cpf=seg_raw.get("cpf"),
        professor=seg_raw.get("professor", False),
    )

    vinculos = [
        Vinculo(
            data_inicio=date_type.fromisoformat(v["data_inicio"]),
            data_fim=date_type.fromisoformat(v["data_fim"]) if v.get("data_fim") else None,
            empresa=v.get("empresa"),
            cnpj=v.get("cnpj"),
            tipo_vinculo=TipoVinculo(v.get("tipo_vinculo", "Empregado")),
            atividade_especial=v.get("atividade_especial", False),
        )
        for v in vinculos_raw
    ]

    remuneracoes = (
        [
            Remuneracao(
                competencia=date_type.fromisoformat(r["competencia"]),
                valor=Decimal(str(r["valor"])),
            )
            for r in remuneracoes_raw
        ]
        if remuneracoes_raw
        else None
    )

    salario_futuro_raw = payload.get("salario_contribuicao_futuro")
    salario_futuro_decimal = Decimal(str(salario_futuro_raw)) if salario_futuro_raw else None

    if job_uuid:
        await add_job_event(
            job_uuid=job_uuid,
            event_type="processing",
            payload={"progress": 30, "step": "calculating"},
        )

    # Buscar dados de referência do banco
    indices_inpc = await _buscar_indices_inpc()
    tabua = await _buscar_tabua_mortalidade()
    teto, piso = await _buscar_teto_piso()

    resultado = simular_aposentadoria(
        segurado=segurado,
        vinculos=vinculos,
        remuneracoes=remuneracoes,
        indices_inpc=indices_inpc,
        tabua_mortalidade=tabua,
        teto_inss=teto,
        piso_inss=piso,
        salario_contribuicao_futuro=salario_futuro_decimal,
    )

    if job_uuid:
        await add_job_event(
            job_uuid=job_uuid,
            event_type="processing",
            payload={"progress": 70, "step": "generating_pdf"},
        )

    # Serializar resultado
    output = {
        "detalhes": {
            "tempo_contribuicao": {
                "anos": resultado.tempo_contribuicao.anos,
                "meses": resultado.tempo_contribuicao.meses,
                "dias": resultado.tempo_contribuicao.dias,
                "total_dias": resultado.tempo_contribuicao.total_dias,
                "vinculos_processados": resultado.tempo_contribuicao.vinculos_processados,
                "alertas": resultado.tempo_contribuicao.alertas,
            },
            "media_salarial": {
                "media_100": float(resultado.media_salarial.media_100),
                "media_80": float(resultado.media_salarial.media_80),
                "qtd_contribuicoes": resultado.media_salarial.qtd_contribuicoes,
                "maior_contribuicao": float(resultado.media_salarial.maior_contribuicao),
                "menor_contribuicao": float(resultado.media_salarial.menor_contribuicao),
            }
            if resultado.media_salarial
            else None,
            "cenarios": [
                {
                    "regra": c.regra.value,
                    "regra_nome": c.regra_nome,
                    "elegivel": c.elegivel,
                    "data_elegibilidade": c.data_elegibilidade.isoformat()
                    if c.data_elegibilidade
                    else None,
                    "beneficio_estimado": float(c.beneficio_estimado)
                    if c.beneficio_estimado
                    else None,
                    "coeficiente": c.coeficiente,
                    "fator_previdenciario": c.fator_previdenciario,
                    "requisitos_faltantes": c.requisitos_faltantes,
                }
                for c in resultado.cenarios
            ],
            "melhor_cenario": resultado.melhor_cenario.value if resultado.melhor_cenario else None,
            "alertas": resultado.alertas,
            "projecao": _serializar_projecao(resultado.projecao) if resultado.projecao else None,
        }
    }

    # Gerar PDF (por enquanto markdown, futuro: DOCX template)
    try:
        md = _render_aposentadoria_simulacao_markdown(resultado)
        pdf_bytes = ai_service._markdown_to_pdf_bytes(md, title="Simulação de Aposentadoria INSS")

        if pdf_bytes and pdf_bytes.lstrip().startswith(b"%PDF"):
            from src.core.storage import StorageService

            storage = StorageService()
            filename = f"aposentadoria_simulacao_{calculation_id_str or str(job_uuid)}.pdf"
            uploaded = await storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=str(client_id) if client_id else None,
                functionality="calculators",
                job_uuid=str(job_uuid) if job_uuid else "unknown",
                filename=filename,
                expires_in=3600,
                output=True,
            )

            doc_id = None
            bucket = uploaded.get("bucket", "documents")
            storage_path = uploaded.get("storage_path", "")
            download_url = uploaded.get("signed_url") or uploaded.get("download_url") or ""

            if job_uuid and bucket and storage_path:
                calc_uuid = None
                if calculation_id_str:
                    try:
                        calc_uuid = uuid.UUID(calculation_id_str)
                    except Exception:
                        pass
                checksum = hashlib.sha256(pdf_bytes).hexdigest()
                try:
                    doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=str(client_id) if client_id else None,
                        document_type="calculator_aposentadoria_simulacao_pdf",
                        bucket=bucket,
                        storage_path=storage_path,
                        filename=filename,
                        checksum_sha256=checksum,
                        size_bytes=len(pdf_bytes),
                        metadata={"calculator_key": "previdencia.aposentadoria-simulacao"},
                        source="calculator",
                        calculation_id=calc_uuid,
                    )
                except Exception:
                    logger.exception("Failed to create aposentadoria_simulacao document")

            if doc_id:
                output["document_id"] = str(doc_id)
            if download_url:
                output["download_url"] = download_url
    except Exception:
        logger.exception("Failed to generate aposentadoria_simulacao PDF (calculation succeeded)")

    return output


def _render_aposentadoria_simulacao_markdown(resultado) -> str:
    """Render simulação como markdown para PDF."""
    from datetime import date

    seg = resultado.segurado
    tc = resultado.tempo_contribuicao

    lines = [
        "# Simulação de Aposentadoria INSS",
        "",
        "## Dados do Segurado",
        f"- **Nome**: {seg.nome or 'Não informado'}",
        f"- **CPF**: {seg.cpf or 'Não informado'}",
        f"- **Data de Nascimento**: {seg.data_nascimento.strftime('%d/%m/%Y')}",
        f"- **Sexo**: {'Masculino' if seg.sexo.value == 'M' else 'Feminino'}",
        f"- **Professor(a)**: {'Sim' if seg.professor else 'Não'}",
        "",
        "## Tempo de Contribuição",
        f"**{tc.anos} anos, {tc.meses} meses e {tc.dias} dias** ({tc.total_dias} dias)",
        f"- Vínculos processados: {tc.vinculos_processados}",
        "",
    ]

    if resultado.media_salarial:
        ms = resultado.media_salarial
        lines.extend(
            [
                "## Salário de Benefício",
                f"- Média 100% (pós-reforma): **R$ {float(ms.media_100):,.2f}**",
                f"- Média 80% melhores (pré-reforma): **R$ {float(ms.media_80):,.2f}**",
                f"- Contribuições consideradas: {ms.qtd_contribuicoes}",
                "",
            ]
        )

    lines.extend(["## Cenários de Aposentadoria", ""])

    for c in resultado.cenarios:
        status_icon = "✅" if c.elegivel else "⏳"
        lines.append(f"### {status_icon} {c.regra_nome}")
        if c.elegivel:
            lines.append("**Elegível para aposentadoria.**")
            if c.beneficio_estimado:
                lines.append(f"- Benefício estimado: **R$ {float(c.beneficio_estimado):,.2f}**")
            if c.coeficiente:
                lines.append(f"- Coeficiente: {c.coeficiente * 100:.0f}%")
            if c.fator_previdenciario:
                lines.append(f"- Fator previdenciário: {c.fator_previdenciario:.4f}")
        else:
            if c.data_elegibilidade:
                lines.append(f"- Data estimada: **{c.data_elegibilidade.strftime('%d/%m/%Y')}**")
            for req in c.requisitos_faltantes:
                lines.append(f"- {req}")
        lines.append("")

    if resultado.melhor_cenario:
        melhor = next((c for c in resultado.cenarios if c.regra == resultado.melhor_cenario), None)
        if melhor:
            lines.extend(
                [
                    "## 🏆 Cenário Recomendado",
                    f"**{melhor.regra_nome}**",
                    "",
                ]
            )

    if resultado.alertas:
        lines.extend(["## Alertas", ""])
        for a in resultado.alertas:
            lines.append(f"- ⚠️ {a}")
        lines.append("")

    lines.extend(
        [
            "---",
            "*Esta simulação tem caráter informativo e não substitui orientação jurídica especializada.*",
            f"*Gerado em {date.today().strftime('%d/%m/%Y')} por Processa AI*",
        ]
    )

    return "\n".join(lines)


async def _buscar_indices_inpc() -> dict | None:
    """Busca índices INPC do banco para correção monetária."""
    try:
        from decimal import Decimal

        from src.core.db import get_pool

        pool = await get_pool()
        async with pool.connection() as conn:
            cursor = await conn.execute(
                "SELECT competencia, fator_acumulado FROM calc_engine.indices_inpc WHERE fator_acumulado IS NOT NULL"
            )
            rows = await cursor.fetchall()
            if rows:
                return {row[0]: Decimal(str(row[1])) for row in rows}
    except Exception:
        logger.warning("Could not fetch INPC indices from database")
    return None


async def _buscar_tabua_mortalidade() -> dict | None:
    """Busca tábua de mortalidade IBGE mais recente do banco."""
    try:
        from src.core.db import get_pool

        pool = await get_pool()
        async with pool.connection() as conn:
            cursor = await conn.execute(
                """SELECT idade, expectativa_sobrevida FROM calc_engine.tabua_mortalidade
                   WHERE ano_referencia = (SELECT MAX(ano_referencia) FROM calc_engine.tabua_mortalidade)"""
            )
            rows = await cursor.fetchall()
            if rows:
                return {int(row[0]): float(row[1]) for row in rows}
    except Exception:
        logger.warning("Could not fetch mortality table from database")
    return None


async def _buscar_teto_piso():
    """Busca teto e piso do INSS mais recente do banco."""
    from decimal import Decimal

    try:
        from src.core.db import get_pool

        pool = await get_pool()
        async with pool.connection() as conn:
            cursor = await conn.execute(
                "SELECT salario_minimo, teto_inss FROM calc_engine.parametros_anuais_inss ORDER BY ano DESC LIMIT 1"
            )
            row = await cursor.fetchone()
            if row:
                return Decimal(str(row[1])), Decimal(str(row[0]))
    except Exception:
        logger.warning("Could not fetch INSS parameters from database")
    return Decimal("8475.55"), Decimal("1621.00")


async def _handle_job(job_row: dict) -> None:
    """Route job to appropriate handler based on job_type."""
    job_type = str(job_row.get("job_type") or "").strip()

    if job_type in (
        "cnis_analysis",
        "process_summary",
        "labor_claim",
        "brief_scanner",
        "audio_transcription",
    ):
        await _handle_ai_job(job_row)
        return

    if job_type == "rag_ingest":
        await _handle_rag_ingest_job(job_row)
        return

    if job_type in ("calculator_rescisao",):
        await _handle_calculator_job(job_row)
        return

    if job_type in (
        "parse_cnis",
        "calculator_tempo_contribuicao",
        "calculator_media_salarial",
        "calculator_aposentadoria_simulacao",
    ):
        await _handle_previdencia_job(job_row)
        return

    if job_type.startswith("calendar_") or job_type.startswith("office_"):
        await _handle_office_job(job_row)
        return

    logger.warning("Unknown job type: %s", job_type)


async def _run_ai_worker() -> None:
    """Main loop for AI/calculator/office jobs.

    dequeue_job() returns a dict from the unified jobs table
    (id, job_type, user_id, client_id, request_payload) or None.
    """
    logger.info("Processa AI Worker started - waiting for jobs...")

    while not _shutdown_event.is_set():
        job_row = await dequeue_job()
        if not job_row:
            await asyncio.sleep(settings.POLL_INTERVAL_S)
            continue

        job_uuid = job_row.get("id")
        job_type = job_row.get("job_type", "unknown")
        logger.info("Processing job: %s (type: %s)", job_uuid, job_type)

        try:
            await asyncio.wait_for(_handle_job(job_row), timeout=600)
            logger.info("Job %s completed", job_uuid)
        except asyncio.TimeoutError:
            logger.error("Job %s timed out after 600 seconds", job_uuid)
            # Return to queue for retry via nack
            await nack_job(job_uuid)
            try:
                if isinstance(job_uuid, uuid.UUID):
                    await mark_job_failed(job_uuid=job_uuid, error="Job timed out after 10 minutes")
            except Exception:
                logger.exception("Failed to mark timed-out job %s as failed", job_uuid)
        except Exception:
            logger.exception("Unhandled error processing job: %s", job_uuid)
            # Return to queue for retry via nack
            await nack_job(job_uuid)

    logger.info("AI Worker loop stopped (shutdown requested)")


async def _run_translation_worker() -> None:
    """Dedicated loop for fast translation jobs (separate from heavy AI jobs)."""
    from src.handlers.translate_timeline import handle_translate_timeline_event

    logger.info("Translation Worker started - waiting for translation jobs...")

    while not _shutdown_event.is_set():
        job_row = await dequeue_translation_job()
        if not job_row:
            await asyncio.sleep(settings.TRANSLATION_POLL_INTERVAL_S)
            continue

        job_uuid = job_row.get("id")
        job_type = job_row.get("job_type", "unknown")
        payload = job_row.get("request_payload") or {}
        event_id = payload.get("timeline_event_id", "unknown")
        logger.info("Processing translation job: event=%s (type: %s)", event_id, job_type)

        try:
            if job_type == "translate_timeline_event":
                await asyncio.wait_for(handle_translate_timeline_event(payload), timeout=60)
            else:
                logger.warning("Unknown translation job type: %s", job_type)

            # Mark completed (translation jobs are fire-and-forget, no result payload)
            if isinstance(job_uuid, uuid.UUID):
                try:
                    await mark_job_completed(job_uuid=job_uuid, result_payload={})
                except Exception:
                    pass
        except asyncio.TimeoutError:
            logger.error("Translation job timed out after 60s: event=%s", event_id)
            await nack_job(job_uuid)
        except Exception:
            logger.exception("Unhandled error processing translation job: event=%s", event_id)
            await nack_job(job_uuid)


async def _run_reaper() -> None:
    """Periodically re-enqueue jobs stuck in 'processing' state.

    Runs every 60 seconds. Jobs stuck longer than VISIBILITY_TIMEOUT_S
    are returned to 'queued'. Jobs exceeding MAX_RETRIES go to 'dead'.
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

                    # Get queue stats from unified jobs table
                    await cur.execute(
                        "SELECT status, COUNT(*) AS cnt FROM public.jobs GROUP BY status"
                    )
                    rows = await cur.fetchall()
                    queue_stats = {row[0]: row[1] for row in rows}

                    health["status"] = "healthy"
                    health["db"] = "connected"
                    health["queue"] = {
                        "queued": queue_stats.get("queued", 0),
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
