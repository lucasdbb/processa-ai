from fastapi import APIRouter, Depends, Request, Body, Query
from typing import List

from src.core.auth import get_user_id, verify_internal_token
from src.features.billing.credits.service import credits_service
from src.features.billing.credits.schemas import (
    CreditCheckResponse,
    FeatureCostItem,
    CreditPackage,
    PurchaseCheckoutResponse,
    PurchaseCreditsRequest,
    CreditHistoryResponse,
    ClaimWelcomeRequest
)

router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.get("/balance")
async def get_credits_balance(user_id: str = Depends(get_user_id)):
    """Get user's current credit balance."""
    return await credits_service.get_user_credits(user_id)

@router.get("/check/{feature_key}", response_model=CreditCheckResponse)
async def check_credits(
    feature_key: str,
    user_id: str = Depends(get_user_id)
):
    """Verifica se user tem créditos suficientes para uma feature."""
    return await credits_service.check_credits(user_id, feature_key)

@router.get("/costs", response_model=List[FeatureCostItem])
async def get_costs():
    """Lista custos de todas as features."""
    return await credits_service.get_all_feature_costs()

@router.get("/packages", response_model=List[CreditPackage])
async def get_packages():
    """Lista pacotes de créditos disponíveis para compra."""
    return await credits_service.get_packages()

@router.get("/history", response_model=CreditHistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_user_id)
):
    """Histórico de transações de créditos."""
    return await credits_service.get_transaction_history(user_id, page, page_size)

@router.post("/purchase", response_model=PurchaseCheckoutResponse)
async def purchase_credits(
    data: PurchaseCreditsRequest,
    user_id: str = Depends(get_user_id)
):
    """Cria checkout session do Stripe para compra de créditos."""
    return await credits_service.create_purchase_checkout(user_id, data.package_id, data.redirect_url)

@router.post("/claim-welcome")
async def claim_welcome_credits(
    request: Request,
    data: ClaimWelcomeRequest,
    user_id: str = Depends(get_user_id)
):
    """Reivindica créditos de boas-vindas (requer CPF)."""
    # Tenta pegar IP real se estiver atrás de proxy
    ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()
    return await credits_service.grant_welcome_credits(user_id, data.cpf, ip)
