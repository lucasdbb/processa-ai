"""Fees/Honorários schemas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

FeeType = Literal[
    "initial",  # Honorários iniciais/entrada
    "success",  # Honorários de exito
    "monthly",  # Mensalidade
    "hourly",  # Por hora
    "hearing",  # Por audiência
    "petition",  # Por petição
    "other",  # Outros
]

FeeStatus = Literal[
    "pending",  # Aguardando pagamento
    "paid",  # Pago
    "overdue",  # Em atraso
    "cancelled",  # Cancelado
]


class FeeCreate(BaseModel):
    """Schema for creating a fee."""

    client_id: UUID
    process_id: UUID | None = None
    service_id: UUID | None = None
    fee_type: FeeType
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0)
    due_date: date | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_process_or_service(self):
        """Validate that exactly one of process_id or service_id is provided."""
        if self.process_id is None and self.service_id is None:
            raise ValueError("Either process_id or service_id must be provided")
        if self.process_id is not None and self.service_id is not None:
            raise ValueError("Cannot provide both process_id and service_id")
        return self


class FeeUpdate(BaseModel):
    """Schema for updating a fee."""

    process_id: UUID | None = None
    service_id: UUID | None = None
    fee_type: FeeType | None = None
    description: str | None = Field(None, min_length=1, max_length=255)
    amount: Decimal | None = Field(None, gt=0)
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
    service_id: UUID | None
    fee_type: FeeType
    description: str
    amount: Decimal
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
    service_id: UUID | None = None
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
