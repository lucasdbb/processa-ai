"""Fees/Honorários router."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.fees.schemas import (
    FeeCreate,
    FeeListParams,
    FeeListResponse,
    FeeResponse,
    FeeStatus,
    FeeSummaryResponse,
    FeeType,
    FeeUpdate,
)
from src.features.office.fees.service import fees_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=FeeListResponse)
async def list_fees(
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    process_id: UUID | None = Query(None, description="Filter by process ID"),
    service_id: UUID | None = Query(None, description="Filter by service ID"),
    fee_type: FeeType | None = Query(None, description="Filter by fee type"),
    fee_status: FeeStatus | None = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List fees for the current user."""
    params = FeeListParams(
        client_id=client_id,
        process_id=process_id,
        service_id=service_id,
        fee_type=fee_type,
        status=fee_status,
        limit=limit,
        offset=offset,
    )
    fees, total = await fees_service.list_fees(user_id, params)
    return FeeListResponse(fees=fees, total=total)


@router.get("/summary/{client_id}", response_model=FeeSummaryResponse)
async def get_fee_summary(
    client_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get fee summary for a client."""
    return await fees_service.get_summary_by_client(user_id, client_id)


@router.get("/{fee_id}", response_model=FeeResponse)
async def get_fee(
    fee_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single fee by ID."""
    fee = await fees_service.get_fee(user_id, fee_id)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found",
        )
    return fee


@router.post("", response_model=FeeResponse, status_code=status.HTTP_201_CREATED)
async def create_fee(
    data: FeeCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new fee."""
    return await fees_service.create_fee(user_id, data)


@router.put("/{fee_id}", response_model=FeeResponse)
async def update_fee(
    fee_id: UUID,
    data: FeeUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing fee."""
    fee = await fees_service.update_fee(user_id, fee_id, data)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found",
        )
    return fee


@router.post("/{fee_id}/pay", response_model=FeeResponse)
async def mark_fee_as_paid(
    fee_id: UUID,
    amount: Decimal | None = Query(
        None,
        ge=0,
        description="Amount paid (defaults to full amount)",
    ),
    user_id: UUID = Depends(get_user_id),
):
    """Mark a fee as paid."""
    fee = await fees_service.mark_as_paid(user_id, fee_id, amount)
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found",
        )
    return fee


@router.delete("/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee(
    fee_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a fee."""
    deleted = await fees_service.delete_fee(user_id, fee_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found",
        )
