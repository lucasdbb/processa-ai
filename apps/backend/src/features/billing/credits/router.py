from fastapi import APIRouter, Depends

from src.core.auth import get_user_id, verify_internal_token
from src.features.billing.credits.service import credits_service

router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.get("/balance")
async def get_credits_balance(user_id: str = Depends(get_user_id)):
    """Get user's current credit balance."""
    return await credits_service.get_user_credits(user_id)
