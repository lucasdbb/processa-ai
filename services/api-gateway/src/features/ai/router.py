"""AI feature router - proxies to ai-worker service"""

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)

from src.core.auth import get_current_user
from src.core.config import settings
from src.core.logging import logger
from src.features.ai.schemas import (
    AnalysisHistoryResponse,
    DocumentDownloadResponse,
    JobStatusResponse,
)

router = APIRouter()


async def _proxy_to_ai_worker(
    *,
    method: str,
    path: str,
    user_token: str | None = None,
    json: dict | None = None,
    files: dict | None = None,
    params: dict | None = None,
) -> dict:
    """Helper para fazer proxy de requests para o ai-worker."""
    base_url = settings.AI_WORKER_BASE_URL.rstrip("/")
    internal_token = settings.AI_WORKER_INTERNAL_TOKEN

    url = f"{base_url}{path}"
    headers = {"X-Internal-Token": internal_token}

    if user_token:
        headers["X-Supabase-Access-Token"] = user_token

    try:
        async with httpx.AsyncClient(timeout=settings.UPSTREAM_TIMEOUT_S) as client:
            if method == "GET":
                resp = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                if files:
                    resp = await client.post(
                        url, headers=headers, files=files, data=json
                    )
                else:
                    resp = await client.post(url, headers=headers, json=json)
            else:
                raise ValueError(f"Método HTTP não suportado: {method}")
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Tempo limite ao aguardar resposta do serviço de IA",
        )
    except httpx.RequestError as e:
        logger.error(f"Erro de conexão com ai-worker: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Erro de conexão com o serviço de IA",
        )

    if resp.status_code >= 400:
        try:
            data = resp.json()
            detail = data.get("detail", "Erro no serviço de IA")
        except Exception:
            detail = "Erro no serviço de IA"
        raise HTTPException(status_code=resp.status_code, detail=detail)

    try:
        return resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta inválida do serviço de IA",
        )


@router.post("/cnis-analysis", status_code=status.HTTP_202_ACCEPTED)
async def cnis_analysis(
    request: Request,
    file: UploadFile = File(...),
    client_id: str | None = Form(None),
    store_pdf: bool = Form(False),
    signed_url_expires_in: int = Form(600),
    user=Depends(get_current_user),
):
    """
    Submete análise de CNIS via upload multipart.
    Frontend envia PDF → Gateway → AI Worker (multipart)
    """
    # Validar PDF
    is_pdf = file.content_type == "application/pdf" or (
        file.filename or ""
    ).lower().endswith(".pdf")
    if not is_pdf:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo PDF"
        )

    # Extrair user_id do token
    token = user.get("token")
    user_id = user.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user_id não encontrado no token",
        )

    # Fazer proxy multipart para ai-worker
    # Precisamos recriar o UploadFile para enviar ao ai-worker
    file_content = await file.read()

    files = {"file": (file.filename, file_content, "application/pdf")}

    form_data = {
        "user_id": user_id,
        "client_id": client_id or "",
        "store_pdf": str(store_pdf).lower(),
        "signed_url_expires_in": str(signed_url_expires_in),
    }

    result = await _proxy_to_ai_worker(
        method="POST",
        path="/api/v1/ai/analyses/cnis-upload",
        user_token=token,
        json=form_data,
        files=files,
    )

    return result

    # Por enquanto, retornar erro indicando que precisa implementar
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Upload direto ainda não implementado. Use o backend antigo por enquanto.",
    )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    user=Depends(get_current_user),
):
    """Consulta status de um job de análise."""
    token = user.get("token")

    result = await _proxy_to_ai_worker(
        method="GET",
        path=f"/v1/ai/jobs/{job_id}",
        user_token=token,
    )

    return JobStatusResponse(**result)


@router.get("/analyses/history", response_model=AnalysisHistoryResponse)
async def get_analysis_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """Lista histórico de análises do usuário."""
    token = user.get("token")

    # Extrair user_id do token
    # TODO: Decodificar JWT para pegar user_id
    # Por enquanto, passar token e deixar ai-worker validar

    result = await _proxy_to_ai_worker(
        method="GET",
        path="/v1/ai/analyses/history",
        user_token=token,
        params={
            "user_id": "TODO",  # Extrair do JWT
            "limit": limit,
            "offset": offset,
        },
    )

    return AnalysisHistoryResponse(**result)


@router.get(
    "/documents/{document_id}/download", response_model=DocumentDownloadResponse
)
async def download_document(
    document_id: str,
    expires_in: int = Query(600, ge=60, le=3600),
    user=Depends(get_current_user),
):
    """Gera URL de download para documento (input ou output)."""
    token = user.get("token")

    result = await _proxy_to_ai_worker(
        method="GET",
        path=f"/v1/ai/documents/{document_id}/download",
        user_token=token,
        params={"expires_in": expires_in},
    )

    return DocumentDownloadResponse(**result)
