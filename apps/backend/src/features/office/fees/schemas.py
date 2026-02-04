"""Fees/Honorarios schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

FeeType = Literal[
    "initial",  # Honorarios iniciais/entrada
    "success",  # Honorarios de exito
    "monthly",  # Mensalidade
    "hourly",  # Por hora
    "hearing",  # Por audiencia
    "petition",  # Por peticao
    "other",  # Outros
]

FeeStatus = Literal[
    "pending",  # Aguardando pagamento
    "paid",  # Pago
    "overdue",  # Em atraso
    "cancelled",  # Cancelado
    "partial",  # Parcialmente pago
]


class FeeCreate(BaseModel):
    """Schema for creating a fee."""

    client_id: UUID
    process_id: UUID | None = None
    fee_type: FeeType
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    due_date: date | None = None
    notes: str | None = None


class FeeUpdate(BaseModel):
    """Schema for updating a fee."""

    fee_type: FeeType | None = None
    description: str | None = Field(None, min_length=1, max_length=255)
    amount: Decimal | None = Field(None, gt=0)
    paid_amount: Decimal | None = Field(None, ge=0)
    due_date: date | None = None
    paid_at: date | None = None
    status: FeeStatus | None = None
    notes: str | None = None


class FeeResponse(BaseModel):
    """Schema for fee response."""

    id: UUID
    user_id: UUID
    client_id: UUID
    process_id: UUID | None
    fee_type: FeeType
    description: str
    amount: Decimal
    paid_amount: Decimal
    due_date: date | None
    paid_at: date | None
    status: FeeStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeeListResponse(BaseModel):
    """Schema for fee list response."""

    fees: list[FeeResponse]
    total: int


class FeeListParams(BaseModel):
    """Schema for fee list parameters."""

    client_id: UUID | None = None
    process_id: UUID | None = None
    fee_type: FeeType | None = None
    status: FeeStatus | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class FeeSummaryResponse(BaseModel):
    """Schema for fee summary."""

    total_amount: Decimal
    total_paid: Decimal
    total_pending: Decimal
    total_overdue: Decimal
    fees_count: int
    paid_count: int
    pending_count: int
    overdue_count: int
