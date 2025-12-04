from fastapi import APIRouter, Depends, Query, status

from src.core.dependencies import get_current_user
from src.features.newsletter.schemas import (
    PreferencesUpdate,
    SubscribeRequest,
    SubscribeResponse,
    UnsubscribeRequest,
)
from src.features.newsletter.service import NewsletterService

router = APIRouter()
service = NewsletterService()


@router.post("/subscribe", status_code=status.HTTP_201_CREATED, response_model=SubscribeResponse)
async def subscribe(data: SubscribeRequest):
    user_id = None
    return await service.subscribe(
        email=data.email,
        topics=data.topics or None,
        channel=data.channel,
        consent=data.consent,
        user_id=user_id,
    )


@router.get("/confirm")
async def confirm(token: str = Query(...)):
    return await service.confirm(token)


@router.patch("/preferences")
async def update_preferences(data: PreferencesUpdate, user=Depends(get_current_user)):
    return await service.update_preferences(
        user_id=user.id,
        topics=data.topics or None,
    )


@router.post("/unsubscribe")
async def unsubscribe(data: UnsubscribeRequest):
    return await service.unsubscribe(data.token)
