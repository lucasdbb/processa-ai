from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ProcessStatus = Literal["active", "pending", "suspended", "archived", "concluded", "cancelled"]


class ProcessCreate(BaseModel):
    client_id: UUID
    process_number: str = Field(..., min_length=1, max_length=255)
    court: str | None = None
    tribunal: str | None = None
    defendant: str | None = None
    type: str = Field(..., min_length=1, max_length=255)
    area: str | None = None
    subject: str | None = None
    value: Decimal | None = None
    notes: str | None = None
    start_date: date | None = None


class ProcessUpdate(BaseModel):
    process_number: str | None = Field(None, min_length=1, max_length=255)
    court: str | None = None
    tribunal: str | None = None
    defendant: str | None = None
    type: str | None = None
    area: str | None = None
    subject: str | None = None
    value: Decimal | None = None
    status: ProcessStatus | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class ProcessResponse(BaseModel):
    id: UUID
    user_id: UUID
    client_id: UUID
    process_number: str
    court: str | None
    tribunal: str | None
    defendant: str | None
    type: str
    area: str | None
    subject: str | None
    value: Decimal | None
    status: ProcessStatus
    notes: str | None
    start_date: date | None
    end_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProcessListResponse(BaseModel):
    processes: list[ProcessResponse]
    total: int


class ProcessListParams(BaseModel):
    search: str | None = None
    status: ProcessStatus | None = None
    client_id: UUID | None = None
    court: str | None = None
    tribunal: str | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ProcessDeadlineSummary(BaseModel):
    """Summary of a deadline for process detail view."""

    id: UUID
    title: str
    due_date: str
    status: str
    priority: str | None
    days_until: int


class ProcessTimelineEvent(BaseModel):
    """Timeline event for process detail view."""

    id: UUID
    event_type: str
    title: str
    description: str | None
    event_date: datetime
    created_at: datetime


class ProcessDocumentSummary(BaseModel):
    """Summary of a document for process detail view."""

    id: UUID
    name: str
    mime_type: str | None
    file_size: int | None
    file_url: str | None
    created_at: datetime


class ProcessClientInfo(BaseModel):
    """Client info for process detail view."""

    id: UUID
    name: str
    email: str | None
    phone: str | None
    cpf_cnpj: str | None


class ProcessDetailResponse(BaseModel):
    """Aggregated process detail response."""

    # Basic process info
    id: UUID
    user_id: UUID
    client_id: UUID
    process_number: str
    court: str | None
    tribunal: str | None
    defendant: str | None
    type: str
    area: str | None
    subject: str | None
    value: Decimal | None
    status: ProcessStatus
    notes: str | None
    start_date: date | None
    end_date: date | None
    created_at: datetime
    updated_at: datetime

    # Client info
    client: ProcessClientInfo

    # Aggregated data
    deadlines: list[ProcessDeadlineSummary]
    deadlines_count: int
    overdue_deadlines_count: int
    timeline: list[ProcessTimelineEvent]
    timeline_count: int
    documents: list[ProcessDocumentSummary]
    documents_count: int

    model_config = {"from_attributes": True}
