from fastapi import APIRouter, Depends, status

from src.core.auth import verify_internal_token
from src.features.core.waitlist.schemas import (
    WaitlistCountResponse,
    WaitlistRequest,
    WaitlistResponse,
)
from src.features.core.waitlist.service import WaitlistService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = WaitlistService()


@router.get("/count", response_model=WaitlistCountResponse)
async def get_waitlist_count():
    count = await service.count()
    return {"count": count}


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WaitlistResponse)
async def join_waitlist(data: WaitlistRequest):
    return await service.join(
        email=data.email,
        name=data.name,
        utm_source=data.utm_source,
    )
