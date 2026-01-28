from uuid import uuid4

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile, status

from src.core.ai_worker_store import (
    add_job_event,
    create_job,
    get_document_by_id,
    get_job_status_from_db,
    get_user_analysis_history,
    parse_job_uuid,
    update_job_progress,
)
from src.core.dependencies import require_internal_auth
from src.core.logging import logger
from src.core.queue import enqueue_job, get_job_status, set_job_status
from src.features.ai.schemas import (
    AnalysisHistoryItem,
    AnalysisHistoryResponse,
    CnisAnalysisRequest,
    DocumentDownloadResponse,
    DocumentResponse,
    EnqueueJobResponse,
    JobProgressCallback,
    JobStatusResponse,
)
from src.features.ai.service import AiService

router = APIRouter()


@router.post(
    "/v1/ai/analyses/cnis",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cnis_analysis(
    data: CnisAnalysisRequest,
    _internal=Depends(require_internal_auth),
):
    file_url = (data.file_url or "").strip()
    if not file_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_url obrigatório")

    user_id = (data.user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    job_uuid = uuid4()
    job_id = f"ai:{job_uuid}"

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    try:
        await create_job(
            job_uuid=job_uuid,
            endpoint_key="cnis_analysis",
            user_id=user_id,
            client_id=(data.client_id or "").strip() or None,
            request_payload={
                "job_id": job_id,
                "file_url": file_url,
                "user_id": user_id,
                "client_id": (data.client_id or "").strip() or None,
                "store_pdf": bool(data.store_pdf),
                "signed_url_expires_in": int(data.signed_url_expires_in),
            },
        )
        await add_job_event(
            job_uuid=job_uuid,
            event_type="queued",
            payload={"progress": 0},
        )
    except Exception:
        logger.exception("Failed to persist job in database")

    await enqueue_job(
        {
            "job_id": job_id,
            "job_uuid": str(job_uuid),
            "type": "cnis_analysis",
            "payload": {
                "file_url": file_url,
                "user_id": user_id,
                "client_id": data.client_id,
                "store_pdf": bool(data.store_pdf),
                "signed_url_expires_in": int(data.signed_url_expires_in),
            },
        }
    )
    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/v1/ai/analyses/cnis-upload",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cnis_analysis_upload(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    client_id: str | None = Form(None),
    store_pdf: bool = Form(False),
    signed_url_expires_in: int = Form(600),
    _internal=Depends(require_internal_auth),
):
    """
    Upload de PDF do CNIS via multipart/form-data.

    Parâmetros:
    - file: Arquivo PDF do CNIS
    - user_id: ID do usuário
    - client_id: ID do cliente (opcional)
    - store_pdf: Se deve salvar o PDF processado
    - signed_url_expires_in: Tempo de expiração da URL assinada em segundos
    """
    # Validações
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos PDF são permitidos",
        )

    user_id = user_id.strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id obrigatório",
        )

    # Lê o arquivo em memória
    try:
        pdf_content = await file.read()
    except Exception as e:
        logger.exception("Erro ao ler arquivo")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao ler arquivo: {str(e)}",
        )

    if not pdf_content or len(pdf_content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo vazio",
        )

    # Upload direto para Supabase Storage
    service = AiService()
    try:
        upload_result = await service.upload_input_pdf(
            pdf_bytes=pdf_content,
            filename=file.filename,
            user_id=user_id,
            client_id=client_id.strip() if client_id else None,
            endpoint="cnis_analysis",
            expires_in=signed_url_expires_in,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Erro ao fazer upload do PDF")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao fazer upload: {str(e)}",
        )

    # Enfileira job
    job_uuid = uuid4()
    job_id = f"ai:{job_uuid}"

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    try:
        await create_job(
            job_uuid=job_uuid,
            endpoint_key="cnis_analysis",
            user_id=user_id,
            client_id=client_id.strip() if client_id else None,
            request_payload={
                "job_id": job_id,
                "file_url": upload_result["signed_url"],
                "user_id": user_id,
                "client_id": client_id.strip() if client_id else None,
                "store_pdf": bool(store_pdf),
                "signed_url_expires_in": int(signed_url_expires_in),
                "input_document_id": upload_result.get("document_id"),
                "input_storage_path": upload_result.get("storage_path"),
            },
        )
        await add_job_event(
            job_uuid=job_uuid,
            event_type="queued",
            payload={"progress": 0},
        )
    except Exception:
        logger.exception("Failed to persist job in database")

    await enqueue_job(
        {
            "job_id": job_id,
            "job_uuid": str(job_uuid),
            "type": "cnis_analysis",
            "payload": {
                "file_url": upload_result["signed_url"],
                "user_id": user_id,
                "client_id": client_id,
                "store_pdf": bool(store_pdf),
                "signed_url_expires_in": int(signed_url_expires_in),
                "input_document_id": upload_result.get("document_id"),
                "input_storage_path": upload_result.get("storage_path"),
            },
        }
    )
    return EnqueueJobResponse(job_id=job_id)


@router.get(
    "/v1/ai/jobs/{job_id}",
    response_model=JobStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_ai_job(
    job_id: str,
    _internal=Depends(require_internal_auth),
):
    jid = (job_id or "").strip()
    if not jid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_id obrigatório")

    current = None
    job_uuid = parse_job_uuid(jid)
    if job_uuid:
        try:
            db_status = await get_job_status_from_db(job_uuid=job_uuid)
            if db_status:
                current = {
                    "job_id": jid,
                    "status": db_status.get("status"),
                    "progress": db_status.get("progress"),
                    "result": db_status.get("result"),
                    "error": db_status.get("error"),
                }
        except Exception:
            logger.exception("Failed to load job status from database")

    if not current:
        try:
            current = await get_job_status(jid)
        except Exception:
            logger.exception("Failed to load job status from Redis")
            current = None

    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado")
    return JobStatusResponse(
        job_id=jid,
        status=str(current.get("status") or "unknown"),
        progress=int(current.get("progress") or 0),
        result=(current.get("result") if isinstance(current.get("result"), dict) else None),
        error=(str(current.get("error")) if current.get("error") else None),
    )


@router.post(
    "/v1/ai/jobs/progress",
    status_code=status.HTTP_200_OK,
)
async def update_job_progress_callback(
    data: JobProgressCallback = Body(...),
    _internal=Depends(require_internal_auth),
):
    """Endpoint de callback para n8n atualizar progresso de jobs.

    N8n envia updates durante o processamento:
    - Após OCR: progress=40
    - Após análise: progress=70
    - Após auditoria: progress=95
    """
    job_id = (data.job_id or "").strip()
    if not job_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_id obrigatório")

    progress = data.progress
    if progress < 0 or progress > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="progress deve estar entre 0 e 100"
        )

    message = (data.message or "").strip()

    # Atualizar Redis
    try:
        status_payload = {
            "job_id": job_id,
            "status": "processing",
            "progress": progress,
        }
        if message:
            status_payload["message"] = message

        await set_job_status(job_id, status_payload)
    except Exception:
        logger.exception(f"Erro ao atualizar progresso no Redis para job {job_id}")

    # Atualizar PostgreSQL
    job_uuid = parse_job_uuid(job_id)
    if job_uuid:
        try:
            await update_job_progress(job_uuid=job_uuid, progress=progress)
            await add_job_event(
                job_uuid=job_uuid,
                event_type="progress",
                message=message or f"Progresso: {progress}%",
                payload={"progress": progress},
            )
        except Exception:
            logger.exception(f"Erro ao atualizar progresso no PostgreSQL para job {job_uuid}")

    return {"status": "ok", "job_id": job_id, "progress": progress}


@router.get(
    "/v1/ai/analyses/history",
    response_model=AnalysisHistoryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analysis_history(
    user_id: str = Query(..., description="ID do usuário"),
    limit: int = Query(50, ge=1, le=100, description="Limite de resultados"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    _internal=Depends(require_internal_auth),
):
    """Lista histórico de análises CNIS de um usuário."""
    if not user_id.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    try:
        rows = await get_user_analysis_history(
            user_id=user_id, endpoint_key="cnis_analysis", limit=limit, offset=offset
        )
    except Exception:
        logger.exception("Erro ao buscar histórico de análises")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao buscar histórico",
        )

    items = []
    for row in rows:
        input_doc = None
        if row.get("input_doc_id"):
            input_doc = DocumentResponse(
                id=str(row["input_doc_id"]),
                document_type="input",
                filename=row.get("input_filename") or "documento.pdf",
                size_bytes=row.get("input_size"),
                created_at=(
                    row["input_created_at"].isoformat() if row.get("input_created_at") else ""
                ),
            )

        output_doc = None
        if row.get("output_doc_id"):
            output_doc = DocumentResponse(
                id=str(row["output_doc_id"]),
                document_type="output",
                filename=row.get("output_filename") or "analise.pdf",
                size_bytes=row.get("output_size"),
                created_at=(
                    row["output_created_at"].isoformat() if row.get("output_created_at") else ""
                ),
            )

        result_payload = row.get("result_payload") or {}
        audit_score = result_payload.get("audit_score")

        items.append(
            AnalysisHistoryItem(
                job_id=f"ai:{row['job_id']}",
                status=row.get("status") or "unknown",
                created_at=row["created_at"].isoformat() if row.get("created_at") else "",
                finished_at=(row["finished_at"].isoformat() if row.get("finished_at") else None),
                input_document=input_doc,
                output_document=output_doc,
                audit_score=audit_score,
            )
        )

    return AnalysisHistoryResponse(items=items, total=len(items))


@router.get(
    "/v1/ai/documents/{document_id}/download",
    response_model=DocumentDownloadResponse,
    status_code=status.HTTP_200_OK,
)
async def download_document(
    document_id: str,
    expires_in: int = Query(600, ge=60, le=3600, description="Tempo de expiração em segundos"),
    _internal=Depends(require_internal_auth),
):
    """Gera signed URL para download de um documento (input ou output)."""
    if not document_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="document_id obrigatório"
        )

    try:
        doc_uuid = parse_job_uuid(document_id)
        if not doc_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="document_id inválido"
            )

        doc = await get_document_by_id(document_id=doc_uuid)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
            )

        service = AiService()
        signed_url = await service._generate_signed_url(
            bucket=doc["bucket"], storage_path=doc["storage_path"], expires_in=expires_in
        )

        return DocumentDownloadResponse(
            document_id=document_id,
            download_url=signed_url,
            expires_in=expires_in,
            filename=doc.get("filename") or "documento.pdf",
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"Erro ao gerar URL de download para documento {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao gerar URL de download",
        )
