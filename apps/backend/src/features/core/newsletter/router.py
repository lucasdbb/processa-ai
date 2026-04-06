from fastapi import APIRouter, Depends, Query, Request, status

from src.core.auth import get_user_id, verify_internal_token
from src.core.rate_limit import limiter
from src.features.core.newsletter.schemas import (
    PreferencesUpdate,
    SubscribeRequest,
    SubscribeResponse,
    UnsubscribeRequest,
)
from src.features.core.newsletter.service import NewsletterService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = NewsletterService()


@router.post("/subscribe", status_code=status.HTTP_201_CREATED, response_model=SubscribeResponse)
@limiter.limit("5/minute")
async def subscribe(request: Request, data: SubscribeRequest):
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
async def update_preferences(data: PreferencesUpdate, user_id: str = Depends(get_user_id)):
    return await service.update_preferences(
        user_id=user_id,
        topics=data.topics or None,
    )


@router.post("/unsubscribe")
async def unsubscribe(data: UnsubscribeRequest):
    return await service.unsubscribe(data.token)
