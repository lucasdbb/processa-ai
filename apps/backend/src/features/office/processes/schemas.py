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
    defendant: str | None = None
    type: str = Field(..., min_length=1, max_length=255)
    subject: str | None = None
    value: Decimal | None = None
    notes: str | None = None
    start_date: date | None = None


class ProcessUpdate(BaseModel):
    process_number: str | None = Field(None, min_length=1, max_length=255)
    court: str | None = None
    defendant: str | None = None
    type: str | None = None
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
    defendant: str | None
    type: str
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
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
