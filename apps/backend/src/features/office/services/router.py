"""Services router."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.services.schemas import (
    ServiceCategory,
    ServiceCreate,
    ServiceDetailResponse,
    ServiceListParams,
    ServiceListResponse,
    ServiceResponse,
    ServiceStatus,
    ServiceSummaryResponse,
    ServiceUpdate,
)
from src.features.office.services.service import services_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=ServiceListResponse)
async def list_services(
    search: str | None = Query(None, description="Search by name"),
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    category: ServiceCategory | None = Query(None, description="Filter by category"),
    service_status: ServiceStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List services for the current user."""
    params = ServiceListParams(
        search=search,
        client_id=client_id,
        category=category,
        status=service_status,
        limit=limit,
        offset=offset,
    )
    services, total = await services_service.list_services(user_id, params)
    return ServiceListResponse(services=services, total=total)


@router.get("/count")
async def count_services(
    user_id: UUID = Depends(get_user_id),
):
    """Count active services for the current user."""
    return await services_service.count_services(user_id)


@router.get("/summary/{client_id}", response_model=ServiceSummaryResponse)
async def get_service_summary(
    client_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get service summary for a client."""
    return await services_service.get_summary_by_client(user_id, client_id)


@router.get("/{service_id}", response_model=ServiceResponse)
async def get_service(
    service_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single service by ID."""
    service = await services_service.get_service(user_id, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )
    return service


@router.get("/{service_id}/detail", response_model=ServiceDetailResponse)
async def get_service_detail(
    service_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get detailed service information with aggregated data."""
    service = await services_service.get_service_detail(user_id, service_id)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )
    return service


@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new service."""
    return await services_service.create_service(user_id, data)


@router.put("/{service_id}", response_model=ServiceResponse)
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing service."""
    service = await services_service.update_service(user_id, service_id, data)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )
    return service


@router.post("/{service_id}/pay", response_model=ServiceResponse)
async def mark_service_as_paid(
    service_id: UUID,
    amount: Decimal | None = Query(None, description="Amount paid (defaults to full value)"),
    user_id: UUID = Depends(get_user_id),
):
    """Register a payment for a service."""
    service = await services_service.mark_as_paid(user_id, service_id, amount)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )
    return service


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a service."""
    deleted = await services_service.delete_service(user_id, service_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found",
        )
