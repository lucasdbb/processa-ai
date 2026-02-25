from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from src.core.auth import get_current_admin, get_current_user
from src.features.core.feedback.schemas import (
    FeedbackCreate,
    FeedbackListResponse,
    FeedbackResponse,
    FeedbackUpdate,
)
from src.features.core.feedback.service import FeedbackService

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_feedback(data: FeedbackCreate, current_user=Depends(get_current_user)):
    service = FeedbackService()
    return await service.create(current_user.id, data)


@router.get("/", response_model=FeedbackListResponse)
async def list_feedback(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user=Depends(get_current_admin),
):
    service = FeedbackService()
    data, total = await service.list_all(limit, offset, status, sort_order)

    # Map profiles data to flat structure if needed, or Pydantic might handle it if schema matches.
    # Supabase returns nested dict: { ..., "profiles": {"email": "...", "name": "..."} }
    # Our schema expects user_email/user_name at top level.

    result = []
    for item in data:
        profile = item.get("profiles")
        if profile:
            item["user_email"] = profile.get("email")
            item["user_name"] = profile.get("name")
        result.append(item)

    return FeedbackListResponse(items=result, total=total)


@router.patch("/{id}", response_model=FeedbackResponse)
async def update_feedback(id: UUID, data: FeedbackUpdate, current_user=Depends(get_current_admin)):
    service = FeedbackService()
    return await service.update(id, data)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(id: UUID, current_user=Depends(get_current_admin)):
    service = FeedbackService()
    await service.delete(id)
