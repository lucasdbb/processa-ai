from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.ai_worker_store import (
    add_job_event,
    create_job,
    get_job_status_from_db,
    parse_job_uuid,
)
from src.core.dependencies import require_internal_auth
from src.core.logging import logger
from src.core.queue import enqueue_job, get_job_status, set_job_status
from src.features.ai.schemas import (
    CnisAnalysisRequest,
    EnqueueJobResponse,
    JobStatusResponse,
)

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

    raw_job_id = (data.job_id or "").strip()
    if raw_job_id:
        job_uuid = parse_job_uuid(raw_job_id)
        if not job_uuid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="job_id inválido")
        job_id = raw_job_id
    else:
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
