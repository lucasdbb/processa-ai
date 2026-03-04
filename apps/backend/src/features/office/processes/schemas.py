from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

ProcessStatus = Literal["active", "concluded", "cancelled"]
ClientRole = Literal["author", "defendant"]
ProcessCategory = Literal["judicial", "administrative"]


class ProcessCreate(BaseModel):
    client_id: UUID
    process_number: str = Field(..., min_length=1, max_length=255)
    process_category: ProcessCategory = "judicial"
    court: str | None = None
    tribunal: str | None = None
    defendant: str | None = None
    client_role: ClientRole = "author"
    type: str = Field(..., min_length=1, max_length=255)
    area: str | None = None
    subject: str | None = None
    value: Decimal | None = None
    notes: str | None = None
    start_date: date | None = None
    is_partnership: bool = False
    partner_lawyer: str | None = None
    partner_percentage: Decimal | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def validate_partnership_fields(self) -> "ProcessCreate":
        if self.is_partnership:
            if not self.partner_lawyer:
                raise ValueError("Advogado(a) parceiro(a) é obrigatório quando é uma parceria")
            if self.partner_percentage is None:
                raise ValueError("Percentual do ganho é obrigatório quando é uma parceria")
        return self


class ProcessUpdate(BaseModel):
    process_number: str | None = Field(None, min_length=1, max_length=255)
    process_category: ProcessCategory | None = None
    court: str | None = None
    tribunal: str | None = None
    defendant: str | None = None
    client_role: ClientRole | None = None
    type: str | None = None
    area: str | None = None
    subject: str | None = None
    value: Decimal | None = None
    status: ProcessStatus | None = None
    notes: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_partnership: bool | None = None
    partner_lawyer: str | None = None
    partner_percentage: Decimal | None = Field(None, ge=0, le=100)


class ProcessResponse(BaseModel):
    id: UUID
    user_id: UUID
    client_id: UUID
    client_name: str | None = None
    process_number: str
    process_category: ProcessCategory = "judicial"
    court: str | None
    tribunal: str | None
    defendant: str | None
    client_role: ClientRole = "author"
    type: str
    area: str | None
    subject: str | None
    value: Decimal | None
    status: ProcessStatus
    notes: str | None
    start_date: date | None
    end_date: date | None
    is_partnership: bool = False
    partner_lawyer: str | None = None
    partner_percentage: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProcessListResponse(BaseModel):
    processes: list[ProcessResponse]
    total: int


class ProcessListParams(BaseModel):
    search: str | None = None
    status: ProcessStatus | None = None
    process_category: ProcessCategory | None = None
    client_id: UUID | None = None
    court: str | None = None
    tribunal: str | None = None
    is_partnership: bool | None = None
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


class TimelineDocumentSummary(BaseModel):
    """Minimal document info for timeline events."""

    id: UUID
    name: str
    file_url: str | None


class ProcessTimelineEvent(BaseModel):
    """Timeline event for process detail view."""

    id: UUID
    event_type: str
    title: str
    description: str | None
    event_date: datetime
    documents: list[TimelineDocumentSummary] = []
    created_at: datetime


class ProcessDocumentSummary(BaseModel):
    """Summary of a document for process detail view."""

    id: UUID
    name: str
    mime_type: str | None
    file_size: int | None
    file_url: str | None
    visible_to_client: bool
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
    process_category: ProcessCategory = "judicial"
    court: str | None
    tribunal: str | None
    defendant: str | None
    client_role: ClientRole = "author"
    type: str
    area: str | None
    subject: str | None
    value: Decimal | None
    status: ProcessStatus
    notes: str | None
    start_date: date | None
    end_date: date | None
    is_partnership: bool = False
    partner_lawyer: str | None = None
    partner_percentage: Decimal | None = None
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
