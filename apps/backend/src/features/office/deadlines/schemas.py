from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

DeadlineStatus = Literal["pending", "completed", "cancelled"]
DeadlinePriority = Literal["low", "medium", "high", "urgent"]


class DeadlineCreate(BaseModel):
    process_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    due_date: date
    priority: DeadlinePriority = "medium"
    reminder_days_before: int = Field(default=3, ge=0, le=30)


class DeadlineUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    priority: DeadlinePriority | None = None
    status: DeadlineStatus | None = None
    reminder_days_before: int | None = Field(None, ge=0, le=30)


class DeadlineResponse(BaseModel):
    id: UUID
    user_id: UUID
    process_id: UUID
    title: str
    description: str | None
    due_date: date
    priority: DeadlinePriority
    status: DeadlineStatus
    completed_at: datetime | None
    reminder_days_before: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeadlineListResponse(BaseModel):
    deadlines: list[DeadlineResponse]
    total: int


class DeadlineListParams(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    status: DeadlineStatus | None = None
    priority: DeadlinePriority | None = None
    process_id: UUID | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
