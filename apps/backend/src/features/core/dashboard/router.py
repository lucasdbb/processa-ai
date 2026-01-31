from fastapi import APIRouter, Depends, Query

from src.core.auth import get_user_id, verify_internal_token
from src.features.core.dashboard.service import dashboard_service

router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.get("/stats")
async def get_dashboard_stats(user_id: str = Depends(get_user_id)):
    """Get dashboard statistics."""
    return await dashboard_service.get_dashboard_stats(user_id)


@router.get("/deadlines")
async def get_upcoming_deadlines(
    limit: int = Query(5, ge=1, le=20),
    user_id: str = Depends(get_user_id),
):
    """Get upcoming deadlines."""
    return await dashboard_service.get_upcoming_deadlines(user_id, limit)
