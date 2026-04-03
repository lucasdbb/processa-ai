from fastapi import APIRouter, Depends, HTTPException, status

from src.core.auth import get_user_id, require_internal_auth
from src.core.job_store import delete_job, get_job_status, parse_job_uuid
from src.core.logging import logger
from src.features.jobs.schemas import JobStatusResponse

router = APIRouter()


@router.get(
    "/{job_id}",
    response_model=JobStatusResponse,
    status_code=status.HTTP_200_OK,
)
async def get_job(
    job_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Return the current status of any job type (AI tools, calculators, CNIS, etc.).

    Accepts both plain UUIDs and legacy prefixed IDs (ai:xxx, calc:xxx, cnis:xxx)
    for backwards compatibility with existing frontend callers.
    """
    jid = (job_id or "").strip()
    if not jid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="job_id obrigatório"
        )

    job_uuid = parse_job_uuid(jid)
    if not job_uuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="job_id inválido"
        )

    db_status = None
    try:
        db_status = await get_job_status(job_uuid=job_uuid)
    except Exception:
        logger.exception("Erro ao carregar status do job %s", jid)

    if not db_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado"
        )

    # Verify ownership: never leak another user's job data.
    if db_status.get("user_id") and db_status["user_id"] != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado"
        )

    # Normalize the result so both pdf_url and download_url are always present
    # when either one exists. This avoids breaking older clients that rely on
    # one field name while newer ones rely on the other.
    result = db_status.get("result")
    if isinstance(result, dict):
        if result.get("pdf_url") and not result.get("download_url"):
            result["download_url"] = result["pdf_url"]
        elif result.get("download_url") and not result.get("pdf_url"):
            result["pdf_url"] = result["download_url"]

    return JobStatusResponse(
        job_id=jid,
        status=str(db_status.get("status") or "unknown"),
        progress=int(db_status.get("progress") or 0),
        result=result,
        error=(str(db_status.get("error")) if db_status.get("error") else None),
    )


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_job_endpoint(
    job_id: str,
    user_id: str = Depends(get_user_id),
    _internal=Depends(require_internal_auth),
):
    """Delete a job and all associated generated documents.

    Ownership is verified inside delete_job: a missing or foreign job both
    result in a 404 to avoid leaking existence information.
    """
    jid = (job_id or "").strip()
    if not jid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="job_id obrigatório"
        )

    job_uuid = parse_job_uuid(jid)
    if not job_uuid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="job_id inválido"
        )

    try:
        deleted = await delete_job(job_uuid=job_uuid, user_id=user_id)
    except Exception:
        logger.exception("Erro ao deletar job %s", jid)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao deletar job",
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job não encontrado"
        )
