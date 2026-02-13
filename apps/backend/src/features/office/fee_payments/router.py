"""Fee payments router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.fee_payments.schemas import (
    FeePaymentCreate,
    FeePaymentListResponse,
    FeePaymentResponse,
    FeePaymentUpdate,
)
from src.features.office.fee_payments.service import fee_payments_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("/fee/{fee_id}/payments", response_model=FeePaymentListResponse)
async def list_fee_payments(
    fee_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """List all payments for a specific fee."""
    payments = await fee_payments_service.list_payments(user_id, fee_id)
    return FeePaymentListResponse(payments=payments, total=len(payments))


@router.get("/{payment_id}", response_model=FeePaymentResponse)
async def get_payment(
    payment_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single payment by ID."""
    payment = await fee_payments_service.get_payment(user_id, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    return payment


@router.post("", response_model=FeePaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    data: FeePaymentCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new payment for a fee."""
    try:
        return await fee_payments_service.create_payment(user_id, data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.put("/{payment_id}", response_model=FeePaymentResponse)
async def update_payment(
    payment_id: UUID,
    data: FeePaymentUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing payment."""
    payment = await fee_payments_service.update_payment(user_id, payment_id, data)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a payment."""
    deleted = await fee_payments_service.delete_payment(user_id, payment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
