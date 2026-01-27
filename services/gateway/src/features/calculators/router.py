"""Calculators proxy router - Routes requests to the Calc Engine microservice."""

from fastapi import APIRouter, Depends, Request

from src.core.auth import get_current_user
from src.core.config import settings
from src.core.proxy import proxy_request

router = APIRouter()


@router.post("/trabalhista/rescisao-trabalhista")
async def rescisao_trabalhista(request: Request, user=Depends(get_current_user)):
    """Calculate labor termination (rescisão trabalhista)."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CALC_ENGINE_BASE_URL,
        internal_token=settings.CALC_ENGINE_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/calculators/trabalhista/rescisao-trabalhista",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )
