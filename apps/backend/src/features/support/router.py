from fastapi import APIRouter, status

from src.features.support.schemas import SupportContactRequest, SupportContactResponse
from src.features.support.service import SupportService

router = APIRouter()
service = SupportService()


@router.post("/contact", status_code=status.HTTP_201_CREATED, response_model=SupportContactResponse)
async def contact_support(data: SupportContactRequest):
    return await service.submit_request(data)
