"""Services schemas."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ServiceCategory = Literal[
    "previdenciario",
    "trabalhista",
    "civel",
    "tributario",
    "familiar",
    "empresarial",
    "imobiliario",
    "administrativo",
    "consultoria",
    "outro",
]

ServiceStatus = Literal[
    "active",
    "completed",
    "cancelled",
]


class ServiceCreate(BaseModel):
    """Schema for creating a service."""

    client_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    category: ServiceCategory = "outro"
    value: Decimal | None = Field(None, ge=0)
    notes: str | None = None


class ServiceUpdate(BaseModel):
    """Schema for updating a service."""

    name: str | None = Field(None, min_length=1, max_length=255)
    category: ServiceCategory | None = None
    status: ServiceStatus | None = None
    value: Decimal | None = Field(None, ge=0)
    paid_amount: Decimal | None = Field(None, ge=0)
    notes: str | None = None


class ServiceResponse(BaseModel):
    """Schema for service response."""

    id: UUID
    user_id: UUID
    client_id: UUID
    client_name: str | None = None
    name: str
    category: ServiceCategory
    status: ServiceStatus
    value: Decimal | None
    paid_amount: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ServiceListResponse(BaseModel):
    """Schema for service list response."""

    services: list[ServiceResponse]
    total: int


class ServiceListParams(BaseModel):
    """Schema for service list parameters."""

    search: str | None = None
    client_id: UUID | None = None
    category: ServiceCategory | None = None
    status: ServiceStatus | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ServiceSummaryResponse(BaseModel):
    """Schema for service summary."""

    total_amount: Decimal
    total_paid: Decimal
    total_pending: Decimal
    services_count: int
    active_count: int
    completed_count: int


class ServiceDocumentSummary(BaseModel):
    """Schema for document summary in service detail."""

    id: UUID
    name: str
    mime_type: str | None
    file_size: int | None
    file_url: str | None
    created_at: datetime


class ServiceClientInfo(BaseModel):
    """Schema for client info in service detail."""

    id: UUID
    name: str
    email: str | None
    phone: str | None
    cpf_cnpj: str | None


class ServiceDetailResponse(BaseModel):
    """Schema for detailed service response with aggregated data."""

    # Basic service info (all fields from ServiceResponse)
    id: UUID
    user_id: UUID
    client_id: UUID
    name: str
    category: ServiceCategory
    status: ServiceStatus
    value: Decimal | None
    paid_amount: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime

    # Aggregated related data
    client: ServiceClientInfo
    documents: list[ServiceDocumentSummary]
    documents_count: int

    model_config = {"from_attributes": True}
