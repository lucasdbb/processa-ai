from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

ClientStatus = Literal["active", "inactive", "archived"]


class ClientCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = None
    cpf_cnpj: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    email: EmailStr | None = None
    phone: str | None = None
    cpf_cnpj: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    notes: str | None = None
    status: ClientStatus | None = None


class ClientResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    email: str | None
    phone: str | None
    cpf_cnpj: str | None
    address: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    notes: str | None
    portal_status: str | None = None
    portal_invited_at: datetime | None = None
    status: ClientStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int


class ClientListParams(BaseModel):
    search: str | None = None
    status: ClientStatus | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ClientProcessSummary(BaseModel):
    """Summary of a process for client detail view."""

    id: UUID
    number: str
    type: str
    status: str
    court: str | None
    value: float | None
    next_deadline: str | None = None


class ClientFeeSummary(BaseModel):
    """Summary of fees for client detail view."""

    total_amount: float
    total_paid: float
    total_pending: float
    total_overdue: float
    fees_count: int


class ClientNoteSummary(BaseModel):
    """Summary of a note for client detail view."""

    id: UUID
    title: str
    note_type: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class ClientServiceSummary(BaseModel):
    """Summary of services for client detail view."""

    total_amount: float
    total_paid: float
    total_pending: float
    services_count: int
    active_count: int
    completed_count: int


class ClientDetailResponse(BaseModel):
    """Aggregated client detail response."""

    # Basic client info
    id: UUID
    user_id: UUID
    name: str
    email: str | None
    phone: str | None
    cpf_cnpj: str | None
    address: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    notes: str | None
    portal_status: str | None = None
    portal_invited_at: datetime | None = None
    status: ClientStatus
    created_at: datetime
    updated_at: datetime

    # Aggregated data
    processes: list[ClientProcessSummary]
    processes_count: int
    fees_summary: ClientFeeSummary
    services_summary: ClientServiceSummary
    services_count: int
    recent_notes: list[ClientNoteSummary]
    notes_count: int

    model_config = {"from_attributes": True}
