from fastapi import APIRouter, Depends, status

from src.core.auth import verify_internal_token
from src.features.core.support.schemas import SupportContactRequest, SupportContactResponse
from src.features.core.support.service import SupportService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = SupportService()


@router.post("/contact", status_code=status.HTTP_201_CREATED, response_model=SupportContactResponse)
async def contact_support(data: SupportContactRequest):
    return await service.submit_request(data)
