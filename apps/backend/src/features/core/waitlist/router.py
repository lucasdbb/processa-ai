from fastapi import APIRouter, Depends, Request, status

from src.core.auth import verify_internal_token
from src.core.rate_limit import limiter
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
@limiter.limit("5/minute")
async def join_waitlist(request: Request, data: WaitlistRequest):
    return await service.join(
        email=data.email,
        name=data.name,
        utm_source=data.utm_source,
        ref_code=data.ref_code,
    )
