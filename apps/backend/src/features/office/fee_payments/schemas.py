"""Fee payments schemas."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class FeePaymentCreate(BaseModel):
    """Schema for creating a fee payment."""

    fee_id: UUID
    amount: Decimal = Field(..., gt=0, description="Payment amount")
    payment_date: date | None = Field(default=None, description="Payment date (defaults to today)")
    payment_method: str | None = Field(
        None, max_length=50, description="Payment method (e.g., PIX, card)"
    )
    notes: str | None = Field(None, description="Additional notes about the payment")


class FeePaymentUpdate(BaseModel):
    """Schema for updating a fee payment."""

    amount: Decimal | None = Field(None, gt=0)
    payment_date: date | None = None
    payment_method: str | None = Field(None, max_length=50)
    notes: str | None = None


class FeePaymentResponse(BaseModel):
    """Schema for fee payment response."""

    id: UUID
    user_id: UUID
    fee_id: UUID
    amount: Decimal
    payment_date: date
    payment_method: str | None
    notes: str | None
    created_at: str
    updated_at: str


class FeePaymentListResponse(BaseModel):
    """Schema for fee payment list response."""

    payments: list[FeePaymentResponse]
    total: int
