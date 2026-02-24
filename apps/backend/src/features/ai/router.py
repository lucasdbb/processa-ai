from uuid import uuid4
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status

from src.core.ai_worker_store import (
    add_job_event,
    create_document,
    create_job,
    get_document_by_id,
    get_job_status_from_db,
    get_user_analysis_history,
    parse_job_uuid,
    update_job_payload,
    mark_job_failed,
    get_all_user_jobs,
)
from src.core.auth import require_internal_auth
from src.core.logging import logger
from src.core.queue import enqueue_job, get_job_status, set_job_status
from src.features.ai.schemas import (
    AiToolResponse,
    AiToolsListResponse,
    AnalysisHistoryItem,
    AnalysisHistoryResponse,
    CnisAnalysisRequest,
    DocumentDownloadResponse,
    DocumentResponse,
    EnqueueJobResponse,
    JobStatusResponse,
    ProcessSummaryRequest,
    ChatRequest,
    ChatResponse,
)
from src.features.core.storage.service import StorageService
from src.features.billing.credits.service import CreditsService
from src.core.auth import get_user_id

router = APIRouter()


@router.get("/tools", response_model=AiToolsListResponse)
async def get_ai_tools(_internal=Depends(require_internal_auth)):
    """Retorna lista de ferramentas de IA disponíveis."""
    from src.core.db import get_pool

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT key, display_name, description, icon, variant,
                       display_order, is_locked
                FROM public.ai_endpoints
                ORDER BY display_order, display_name
            """)
            rows = await cur.fetchall()

    tools = []
    for row in rows:
        tools.append(
            AiToolResponse(
                slug=row[0],
                name=row[1],
                description=row[2] or "",
                icon=row[3] or "FileText",
                variant=row[4] or "prompt",
                locked=bool(row[6]),
                order=int(row[5]) if row[5] is not None else 0,
            )
        )

    return AiToolsListResponse(tools=tools)


@router.post(
    "/analyses/cnis",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def cnis_analysis(
    data: CnisAnalysisRequest,
    _internal=Depends(require_internal_auth),
):
    user_id = (data.user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    # Handle multiple files or single file (CNIS usually processes single, but we standardize input)
    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()
    
    # If no files list provided, check for single file params
    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="É necessário fornecer arquivos para análise (file_url/storage_path ou files)")
        
        # Create a single file entry for compatibility
        files_list = [{
            "bucket": data.bucket,
            "storage_path": storage_path,
            "file_url": file_url
        }]

    # Se vier job_uuid do upload, usar. Senão gerar novo.
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
             raise HTTPException(status_code=400, detail="job_uuid inválido")
    else:
        job_uuid = uuid4()
        
    job_id = f"ai:{job_uuid}"

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    # 1. Create Job FIRST to satisfy Foreign Key constraints
    # We create it with a partial payload (missing input_document_id and processed files)
    initial_payload = {
        "job_id": job_id,
        "file_url": file_url, # Legacy
        "storage_path": storage_path, # Legacy
        "bucket": data.bucket, # Legacy
        "files": [], # Placeholder
        "user_id": user_id,
        "client_id": (data.client_id or "").strip() or None,
        "functionality": data.functionality,
        "store_pdf": bool(data.store_pdf),
        "signed_url_expires_in": int(data.signed_url_expires_in),
        "input_document_id": None, # Placeholder
    }

    try:
        await create_job(
            status="queued",
            job_uuid=job_uuid,
            endpoint_key="cnis_analysis",
            user_id=user_id,
            client_id=(data.client_id or "").strip() or None,
            request_payload=initial_payload,
        )
        await add_job_event(
            job_uuid=job_uuid,
            event_type="queued",
            payload={"progress": 0},
        )
    except Exception:
        logger.exception("Failed to persist job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job no banco de dados",
        )

    # 2. Process Files and Create Documents (now linked to the existing job)
    storage_service = StorageService()
    processed_files = []
    input_document_id = None

    try:
        for f in files_list:
            bucket = f.get("bucket")
            spath = f.get("storage_path")
            furl = f.get("file_url")
            fname = f.get("filename")
            
            # Infer filename if missing
            if not fname and spath:
                fname = spath.rsplit("/", 1)[-1]
            if not fname:
                fname = "documento.pdf"

            # Create input document record
            if bucket and spath:
                try:
                    doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=(data.client_id or "").strip() or None,
                        document_type="input",
                        bucket=bucket,
                        storage_path=spath,
                        filename=fname,
                        checksum_sha256=None,
                        size_bytes=None,
                        metadata={"endpoint": "cnis_analysis"},
                    )
                    if doc_id:
                        # Use the first document as the main input for linking
                        if input_document_id is None:
                            input_document_id = str(doc_id)
                except Exception:
                    logger.exception("Failed to create input document record")

            if bucket and spath and not furl:
                try:
                    # Gerar URL assinada de leitura para o worker
                    signed_url = await storage_service.generate_signed_url(
                        bucket=bucket, 
                        storage_path=spath, 
                        expires_in=data.signed_url_expires_in
                    )
                    processed_files.append({
                        "file_url": signed_url,
                        "bucket": bucket,
                        "storage_path": spath,
                        "filename": fname,
                    })
                except Exception:
                    logger.exception("Failed to generate signed URL for worker")
                    raise HTTPException(status_code=500, detail="Erro ao preparar arquivos para processamento")
            elif furl:
                 processed_files.append({
                    "file_url": furl,
                    "bucket": bucket,
                    "storage_path": spath,
                    "filename": fname,
                })

        # 3. Update Job Payload with complete information
        final_payload = {
            **initial_payload,
            "files": processed_files,
            "input_document_id": input_document_id,
        }
        
        await update_job_payload(job_uuid=job_uuid, request_payload=final_payload)

        # 4. Enqueue Job
        await enqueue_job(
            {
                "job_id": job_id,
                "job_uuid": str(job_uuid),
                "type": "cnis_analysis",
                "payload": final_payload,
            }
        )

    except Exception as e:
        logger.exception("Error during job processing setup")
        await mark_job_failed(job_uuid=job_uuid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar arquivos e enfileirar job",
        )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/process-summary",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def process_summary_analysis(
    data: ProcessSummaryRequest,
    _internal=Depends(require_internal_auth),
):
    """Análise de resumo de processo via URL ou storage_path."""
    user_id = (data.user_id or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    # Handle multiple files or single file
    files_list = data.files or []
    file_url = (data.file_url or "").strip()
    storage_path = (data.storage_path or "").strip()
    
    # If no files list provided, check for single file params
    if not files_list:
        if not file_url and not storage_path:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="É necessário fornecer arquivos para análise (file_url/storage_path ou files)")
        
        # Create a single file entry for compatibility
        files_list = [{
            "bucket": data.bucket,
            "storage_path": storage_path,
            "file_url": file_url
        }]

    # Se vier job_uuid do upload, usar. Senão gerar novo.
    if data.job_uuid:
        try:
            job_uuid = uuid.UUID(data.job_uuid)
        except ValueError:
             raise HTTPException(status_code=400, detail="job_uuid inválido")
    else:
        job_uuid = uuid4()

    job_id = f"ai:{job_uuid}"

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    # 1. Create Job FIRST
    initial_payload = {
        "job_id": job_id,
        "file_url": file_url, # Legacy
        "storage_path": storage_path, # Legacy
        "bucket": data.bucket, # Legacy
        "files": [], # Placeholder
        "user_id": user_id,
        "client_id": (data.client_id or "").strip() or None,
        "functionality": data.functionality,
        "store_pdf": bool(data.store_pdf),
        "signed_url_expires_in": int(data.signed_url_expires_in),
        "input_document_id": None, # Placeholder
    }

    try:
        await create_job(
            status="queued",
            job_uuid=job_uuid,
            endpoint_key="process_summary",
            user_id=user_id,
            client_id=(data.client_id or "").strip() or None,
            request_payload=initial_payload,
        )
        await add_job_event(
            job_uuid=job_uuid,
            event_type="queued",
            payload={"progress": 0},
        )
    except Exception:
        logger.exception("Failed to persist job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job no banco de dados",
        )

    # 2. Process Files and Create Documents
    storage_service = StorageService()
    processed_files = []
    input_document_id = None

    try:
        for f in files_list:
            bucket = f.get("bucket")
            spath = f.get("storage_path")
            furl = f.get("file_url")
            fname = f.get("filename")
            
            # Infer filename if missing
            if not fname and spath:
                fname = spath.rsplit("/", 1)[-1]
            if not fname:
                fname = "documento.pdf"

            # Create input document record
            if bucket and spath:
                try:
                    doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=(data.client_id or "").strip() or None,
                        document_type="input",
                        bucket=bucket,
                        storage_path=spath,
                        filename=fname,
                        checksum_sha256=None,
                        size_bytes=None,
                        metadata={"endpoint": "process_summary"},
                    )
                    if doc_id:
                        # Use the first document as the main input for linking
                        if input_document_id is None:
                            input_document_id = str(doc_id)
                except Exception:
                    logger.exception("Failed to create input document record")

            if bucket and spath and not furl:
                try:
                    # Gerar URL assinada de leitura para o worker
                    signed_url = await storage_service.generate_signed_url(
                        bucket=bucket, 
                        storage_path=spath, 
                        expires_in=data.signed_url_expires_in
                    )
                    processed_files.append({
                        "file_url": signed_url,
                        "bucket": bucket,
                        "storage_path": spath,
                        "filename": fname,
                    })
                except Exception:
                    logger.exception("Failed to generate signed URL for worker")
                    raise HTTPException(status_code=500, detail="Erro ao preparar arquivos para processamento")
            elif furl:
                 processed_files.append({
                    "file_url": furl,
                    "bucket": bucket,
                    "storage_path": spath,
                    "filename": fname,
                })

        # 3. Update Job Payload
        final_payload = {
            **initial_payload,
            "files": processed_files,
            "input_document_id": input_document_id,
        }
        
        await update_job_payload(job_uuid=job_uuid, request_payload=final_payload)

        # 4. Enqueue Job
        await enqueue_job(
            {
                "job_id": job_id,
                "job_uuid": str(job_uuid),
                "type": "process_summary",
                "payload": final_payload,
            }
        )

    except Exception as e:
        logger.exception("Error during job processing setup")
        await mark_job_failed(job_uuid=job_uuid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar arquivos e enfileirar job",
        )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/labor-claim",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def labor_claim_analysis(
    data: dict = Body(...),
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

    user_id = (data.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    client_id = data.get("client_id")
    store_pdf = bool(data.get("store_pdf", True))
    signed_url_expires_in = int(data.get("signed_url_expires_in", 600))
    files = data.get("files", [])

    if len(files) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Máximo de 5 arquivos permitidos")

    functionality = data.get("functionality", "ai")

    # Se vier job_uuid do upload, usar. Senão gerar novo.
    if data.get("job_uuid"):
        try:
            job_uuid = uuid.UUID(data.get("job_uuid"))
        except ValueError:
             raise HTTPException(status_code=400, detail="job_uuid inválido")
    else:
        job_uuid = uuid4()

    job_id = f"ai:{job_uuid}"

    # Consume credits before enqueuing
    credits_service = CreditsService()
    credit_result = await credits_service.consume_credits(user_id, "labor_claim")
    if not credit_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes para gerar reclamação trabalhista.",
        )

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    # 1. Create Job FIRST
    initial_payload = {
        "job_id": job_id,
        "prompt": prompt_text,
        "user_id": user_id,
        "client_id": client_id.strip() if client_id else None,
        "functionality": functionality,
        "store_pdf": bool(store_pdf),
        "signed_url_expires_in": int(signed_url_expires_in),
        "files": [], # Placeholder
        "input_document_id": None, # Placeholder
    }

    try:
        await create_job(
            status="queued",
            job_uuid=job_uuid,
            endpoint_key="labor_claim",
            user_id=user_id,
            client_id=client_id.strip() if client_id else None,
            request_payload=initial_payload,
        )
        await add_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to persist job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job no banco de dados",
        )

    # 2. Process Files and Create Documents
    storage_service = StorageService()
    processed_files = []
    input_document_id = None
    
    try:
        for f in files:
            bucket = f.get("bucket")
            storage_path = f.get("storage_path")
            fname = f.get("filename")

            # Infer filename if missing
            if not fname and storage_path:
                fname = storage_path.rsplit("/", 1)[-1]
            if not fname:
                fname = "documento.pdf"

            # Create input document record
            if bucket and storage_path:
                try:
                    doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=client_id.strip() if client_id else None,
                        document_type="input",
                        bucket=bucket,
                        storage_path=storage_path,
                        filename=fname,
                        checksum_sha256=None,
                        size_bytes=None,
                        metadata={"endpoint": "labor_claim"},
                    )
                    if doc_id:
                        # Use the first document as the main input for linking
                        if input_document_id is None:
                            input_document_id = str(doc_id)
                except Exception:
                    logger.exception("Failed to create input document record")
            
            if bucket and storage_path:
                try:
                    # Gerar URL assinada de leitura para o worker
                    signed_url = await storage_service.generate_signed_url(
                        bucket=bucket, 
                        storage_path=storage_path, 
                        expires_in=signed_url_expires_in
                    )
                    processed_files.append({
                        "file_url": signed_url,
                        "bucket": bucket,
                        "storage_path": storage_path,
                        "filename": fname,
                    })
                except Exception:
                    logger.exception("Failed to generate signed URL for worker")
                    # Continue anyway? Or fail? Better fail to avoid partial processing errors.
                    raise HTTPException(status_code=500, detail="Erro ao preparar arquivos para processamento")

        # 3. Update Job Payload
        final_payload = {
            **initial_payload,
            "files": processed_files,
            "input_document_id": input_document_id,
        }
        
        await update_job_payload(job_uuid=job_uuid, request_payload=final_payload)

        # 4. Enqueue Job
        await enqueue_job(
            {
                "job_id": job_id,
                "job_uuid": str(job_uuid),
                "type": "labor_claim",
                "payload": final_payload,
            }
        )

    except Exception as e:
        logger.exception("Error during job processing setup")
        await mark_job_failed(job_uuid=job_uuid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar arquivos e enfileirar job",
        )

    return EnqueueJobResponse(job_id=job_id)


@router.post(
    "/analyses/brief-scanner",
    response_model=EnqueueJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def brief_scanner_analysis(
    data: dict = Body(...),
    _internal=Depends(require_internal_auth),
):
    """
    Analisa peça(s) processual(is) para identificar fragilidades (upload direto).
    """
    files = data.get("files", [])
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie ao menos uma peça processual",
        )

    if len(files) > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Máximo de 5 arquivos permitidos",
        )

    user_id = (data.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="user_id obrigatório")

    client_id = data.get("client_id")
    store_pdf = bool(data.get("store_pdf", True))
    signed_url_expires_in = int(data.get("signed_url_expires_in", 600))

    # Se vier job_uuid do upload, usar. Senão gerar novo.
    if data.get("job_uuid"):
        try:
            job_uuid = uuid.UUID(data.get("job_uuid"))
        except ValueError:
             raise HTTPException(status_code=400, detail="job_uuid inválido")
    else:
        job_uuid = uuid4()

    job_id = f"ai:{job_uuid}"

    # Consume credits before enqueuing
    credits_service = CreditsService()
    credit_result = await credits_service.consume_credits(user_id, "brief_scanner")
    if not credit_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Créditos insuficientes para analisar peças processuais.",
        )

    try:
        await set_job_status(job_id, {"job_id": job_id, "status": "queued", "progress": 0})
    except Exception:
        logger.exception("Failed to persist queued status in Redis")

    # 1. Create Job FIRST
    initial_payload = {
        "job_id": job_id,
        "user_id": user_id,
        "client_id": client_id.strip() if client_id else None,
        "store_pdf": bool(store_pdf),
        "signed_url_expires_in": int(signed_url_expires_in),
        "files": [], # Placeholder
        "input_document_id": None, # Placeholder
    }

    try:
        await create_job(
            status="queued",
            job_uuid=job_uuid,
            endpoint_key="brief_scanner",
            user_id=user_id,
            client_id=client_id.strip() if client_id else None,
            request_payload=initial_payload,
        )
        await add_job_event(job_uuid=job_uuid, event_type="queued", payload={"progress": 0})
    except Exception:
        logger.exception("Failed to persist job in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar job no banco de dados",
        )

    # 2. Process Files and Create Documents
    storage_service = StorageService()
    processed_files = []
    input_document_id = None
    
    try:
        for f in files:
            bucket = f.get("bucket")
            storage_path = f.get("storage_path")
            fname = f.get("filename")

            # Infer filename if missing
            if not fname and storage_path:
                fname = storage_path.rsplit("/", 1)[-1]
            if not fname:
                fname = "documento.pdf"

            # Create input document record
            if bucket and storage_path:
                try:
                    doc_id = await create_document(
                        job_uuid=job_uuid,
                        user_id=user_id,
                        client_id=client_id.strip() if client_id else None,
                        document_type="input",
                        bucket=bucket,
                        storage_path=storage_path,
                        filename=fname,
                        checksum_sha256=None,
                        size_bytes=None,
                        metadata={"endpoint": "brief_scanner"},
                    )
                    if doc_id:
                        # Use the first document as the main input for linking
                        if input_document_id is None:
                            input_document_id = str(doc_id)
                except Exception:
                    logger.exception("Failed to create input document record")
            
            if bucket and storage_path:
                try:
                    # Gerar URL assinada de leitura para o worker
                    signed_url = await storage_service.generate_signed_url(
                        bucket=bucket, 
                        storage_path=storage_path, 
                        expires_in=signed_url_expires_in
                    )
                    processed_files.append({
                        "file_url": signed_url,
                        "bucket": bucket,
                        "storage_path": storage_path,
                        "filename": fname,
                    })
                except Exception:
                    logger.exception("Failed to generate signed URL for worker")
                    raise HTTPException(status_code=500, detail="Erro ao preparar arquivos para processamento")

        # 3. Update Job Payload
        final_payload = {
            **initial_payload,
            "files": processed_files,
            "input_document_id": input_document_id,
        }
        
        await update_job_payload(job_uuid=job_uuid, request_payload=final_payload)

        # 4. Enqueue Job
        await enqueue_job(
            {
                "job_id": job_id,
                "job_uuid": str(job_uuid),
                "type": "brief_scanner",
                "payload": final_payload,
            }
        )
    
    except Exception as e:
        logger.exception("Error during job processing setup")
        await mark_job_failed(job_uuid=job_uuid, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar arquivos e enfileirar job",
        )

    return EnqueueJobResponse(job_id=job_id)


@router.get(
    "/jobs/{job_id}",
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
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
)
async def chat_message(
    data: ChatRequest,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Envia mensagem para o chat jurídico."""
    if not data.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mensagem obrigatória")

    # service = AiService()
    try:
        # result = await service.chat(
        #     message=data.message,
        #     user_id=user_id,
        #     client_id=data.client_id,
        # )
        # return ChatResponse(
        #     response=result["response"],
        #     credits_consumed=result["credits_consumed"]
        # )
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Chat migration in progress")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Erro no chat")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/analyses/history",
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
    "/documents/{document_id}/download",
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
    user_id: str = Query(..., description="ID do usuário"),
    client_id: str | None = Query(None, description="ID do cliente opcional"),
    functionality: str | None = Query(None, description="Filtro por funcionalidade (endpoint_key)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _internal=Depends(require_internal_auth),
):
    """Lista jobs de IA do usuário."""
    jobs = await get_all_user_jobs(
        user_id=user_id,
        client_id=client_id,
        endpoint_key=functionality,
        limit=limit,
        offset=offset
    )
    
    storage_service = StorageService()
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

        processed.append({
            "id": job["id"],
            "created_at": job["created_at"].isoformat() if job["created_at"] else None,
            "status": job["status"],
            "functionality": job["endpoint_key"], 
            "metadata": metadata,
            "result": {
                "download_url": result_payload.get("download_url") or result_payload.get("pdf_url"),
                "pdf_url": result_payload.get("pdf_url"),
                "document_id": job.get("output_document_id"),
                "content": result_payload.get("content"),
                "text": result_payload.get("text")
            }
        })
        
    return processed