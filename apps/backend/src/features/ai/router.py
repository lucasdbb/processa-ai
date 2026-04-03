import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, require_internal_auth
from src.core.job_store import (
    get_all_user_jobs,
    get_document_by_id,
    get_user_analysis_history,
    parse_job_uuid,
)
from src.core.logging import logger
from src.features.ai.chat.router import router as chat_router
from src.features.ai.knowledge_base.router import router as kb_router
from src.features.ai.schemas import (
    AnalysisHistoryItem,
    AnalysisHistoryResponse,
    AudioTranscriptionRequest,
    BriefScannerRequest,
    CnisAnalysisRequest,
    DocumentDownloadResponse,
    DocumentResponse,
    EnqueueJobResponse,
    ProcessSummaryRequest,
)
from src.features.ai.service import AiJobService
from src.features.core.storage.service import StorageService

router = APIRouter()
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(kb_router, prefix="/knowledge-base", tags=["knowledge-base"])
ai_job_service = AiJobService()


@router.post(
    "/analyses/cnis",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cnis_analysis(
    data: CnisAnalysisRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()

    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "É necessário fornecer arquivos para análise (file_url/storage_path ou files)"
                ),
            )
        files_list = [{"bucket": data.bucket, "storage_path": storage_path, "file_url": file_url}]

    job_uuid = None
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="job_uuid inválido")

    job_id = await ai_job_service.submit_job(
        user_id=user_id,
        feature_key="cnis_analysis",
        endpoint_key="cnis_analysis",
        initial_payload={
            "functionality": data.functionality,
            "file_url": file_url,
            "storage_path": storage_path,
            "bucket": data.bucket,
        },
        files=files_list,
        client_id=(data.client_id or "").strip() or None,
        job_uuid=job_uuid,
        signed_url_expires_in=int(data.signed_url_expires_in),
        store_pdf=bool(data.store_pdf),
    )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/process-summary",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def process_summary_analysis(
    data: ProcessSummaryRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Análise de resumo de processo via URL ou storage_path."""

    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()

    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "É necessário fornecer arquivos para análise (file_url/storage_path ou files)"
                ),
            )
        files_list = [{"bucket": data.bucket, "storage_path": storage_path, "file_url": file_url}]

    job_uuid = None
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="job_uuid inválido")

    job_id = await ai_job_service.submit_job(
        user_id=user_id,
        feature_key="process_summary",
        endpoint_key="process_summary",
        initial_payload={
            "functionality": data.functionality,
            "file_url": file_url,
            "storage_path": storage_path,
            "bucket": data.bucket,
        },
        files=files_list,
        client_id=(data.client_id or "").strip() or None,
        job_uuid=job_uuid,
        signed_url_expires_in=int(data.signed_url_expires_in),
        store_pdf=bool(data.store_pdf),
    )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/labor-claim",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def labor_claim_analysis(
    data: dict = Body(...),
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """
    Gera uma reclamação trabalhista a partir de texto + documentos opcionais (upload direto).
    """
    prompt_text = (data.get("prompt") or "").strip()
    if not prompt_text or len(prompt_text) < 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Descreva os fatos do caso (mínimo 50 caracteres)",
        )

    client_id = data.get("client_id")
    store_pdf = bool(data.get("store_pdf", True))
    signed_url_expires_in = int(data.get("signed_url_expires_in", 600))
    files = data.get("files", [])

    if len(files) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Máximo de 5 arquivos permitidos"
        )

    functionality = data.get("functionality", "ai")

    job_uuid = None
    if data.get("job_uuid"):
        try:
            job_uuid = uuid.UUID(data.get("job_uuid"))
        except ValueError:
            raise HTTPException(status_code=400, detail="job_uuid inválido")

    job_id = await ai_job_service.submit_job(
        user_id=user_id,
        feature_key="labor_claim",
        endpoint_key="labor_claim",
        initial_payload={
            "prompt": prompt_text,
            "functionality": functionality,
        },
        files=files,
        client_id=client_id.strip() if client_id else None,
        job_uuid=job_uuid,
        signed_url_expires_in=int(signed_url_expires_in),
        store_pdf=bool(store_pdf),
    )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/brief-scanner",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def brief_scanner_analysis(
    data: BriefScannerRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Analisa peça processual para identificar fragilidades."""

    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()

    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="É necessário fornecer a peça processual para análise",
            )
        files_list = [{"bucket": data.bucket, "storage_path": storage_path, "file_url": file_url}]

    job_uuid = None
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="job_uuid inválido")

    job_id = await ai_job_service.submit_job(
        user_id=user_id,
        feature_key="brief_scanner",
        endpoint_key="brief_scanner",
        initial_payload={
            "functionality": data.functionality,
            "file_url": file_url,
            "storage_path": storage_path,
            "bucket": data.bucket,
        },
        files=files_list,
        client_id=(data.client_id or "").strip() or None,
        job_uuid=job_uuid,
        signed_url_expires_in=int(data.signed_url_expires_in),
        store_pdf=bool(data.store_pdf),
    )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/audio-transcription",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def audio_transcription_analysis(
    data: AudioTranscriptionRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Transcreve áudio de audiências, depoimentos e reuniões."""

    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()

    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="É necessário fornecer o arquivo de áudio para transcrição",
            )
        files_list = [{"bucket": data.bucket, "storage_path": storage_path, "file_url": file_url}]

    job_uuid = None
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
            raise HTTPException(status_code=400, detail="job_uuid inválido")

    job_id = await ai_job_service.submit_job(
        user_id=user_id,
        feature_key="audio_transcription",
        endpoint_key="audio_transcription",
        initial_payload={
            "functionality": data.functionality,
            "file_url": file_url,
            "storage_path": storage_path,
            "bucket": data.bucket,
        },
        files=files_list,
        client_id=(data.client_id or "").strip() or None,
        job_uuid=job_uuid,
        signed_url_expires_in=int(data.signed_url_expires_in),
        store_pdf=False,
    )

    return EnqueueJobResponse(job_id=job_id)


@router.get(
    "/analyses/history",
    response_model=AnalysisHistoryResponse,
    status_code=status.HTTP_200_OK,
)
async def get_analysis_history(
    user_id: str = Depends(get_user_id),
    limit: int = 50,
    offset: int = 0,
    _internal=Depends(require_internal_auth),
):
    """Lista histórico de análises CNIS de um usuário."""

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
                job_id=str(row["job_id"]),
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
    "/documents/{document_id}/download",
    response_model=DocumentDownloadResponse,
    status_code=status.HTTP_200_OK,
)
async def download_document(
    document_id: str,
    expires_in: int = Query(600, ge=60, le=3600, description="Tempo de expiração em segundos"),
    user_id: str = Depends(get_user_id),
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

        # Verificar ownership do documento
        if doc.get("user_id") and doc["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Documento não encontrado"
            )

        storage_service = StorageService()
        signed_url = await storage_service.generate_signed_url(
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


@router.get("/jobs", status_code=status.HTTP_200_OK)
async def get_user_jobs_list(
    user_id: str = Depends(get_user_id),
    client_id: str | None = None,
    functionality: str | None = None,
    limit: int = 50,
    offset: int = 0,
    _internal=Depends(require_internal_auth),
):
    """Lista jobs de IA do usuário."""
    jobs = await get_all_user_jobs(
        user_id=user_id, client_id=client_id, endpoint_key=functionality, limit=limit, offset=offset
    )

    StorageService()
    processed = []
    for job in jobs:
        # Extrair metadados úteis do payload
        metadata = {}
        request_payload = job.get("request_payload") or {}
        result_payload = job.get("result_payload") or {}

        # Nome do arquivo (input)
        files = request_payload.get("files") or []
        if files and len(files) > 0:
            metadata["file_name"] = files[0].get("filename")
        elif request_payload.get("storage_path"):
            metadata["file_name"] = request_payload.get("storage_path").split("/")[-1]
        else:
            metadata["file_name"] = "Análise"

        metadata["client_name"] = job.get("client_name")
        metadata["client_id"] = job.get("client_id")

        processed.append(
            {
                "id": job["id"],
                "created_at": job["created_at"].isoformat() if job["created_at"] else None,
                "status": job["status"],
                "functionality": job["endpoint_key"],
                "metadata": metadata,
                "result": {
                    "download_url": result_payload.get("download_url")
                    or result_payload.get("pdf_url"),
                    "pdf_url": result_payload.get("pdf_url"),
                    "document_id": job.get("output_document_id"),
                    "content": result_payload.get("content"),
                    "text": result_payload.get("text"),
                },
            }
        )

    return processed
