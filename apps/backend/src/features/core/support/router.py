from fastapi import APIRouter, Depends, Request, status

from src.core.auth import verify_internal_token
from src.core.rate_limit import limiter
from src.features.core.support.schemas import (
    ErrorReportRequest,
    ErrorReportResponse,
    SupportContactRequest,
    SupportContactResponse,
)
from src.features.core.support.service import SupportService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = SupportService()


@router.post("/contact", status_code=status.HTTP_201_CREATED, response_model=SupportContactResponse)
@limiter.limit("3/minute")
async def contact_support(request: Request, data: SupportContactRequest):
    return await service.submit_request(data)


@router.post("/error-report", status_code=status.HTTP_200_OK, response_model=ErrorReportResponse)
@limiter.limit("10/minute")
async def report_frontend_error(request: Request, data: ErrorReportRequest):
    """Receive a frontend crash report and notify the admin by email."""
    return await service.report_error(data)
