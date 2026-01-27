from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


DeadlineStatus = Literal["pending", "completed", "overdue"]
DeadlineType = Literal["contestacao", "recurso", "manifestacao", "audiencia", "other"]


class DeadlineCreateRequest(BaseModel):
    type: str = Field(..., min_length=1, max_length=255)
    process_id: str
    date: datetime
    description: str | None = None
    reminder_days: list[int] = Field(default_factory=lambda: [1, 3, 7])


class DeadlineUpdateRequest(BaseModel):
    type: str | None = Field(None, min_length=1, max_length=255)
    date: datetime | None = None
    description: str | None = None
    status: DeadlineStatus | None = None
    reminder_days: list[int] | None = None


class DeadlineResponse(BaseModel):
    id: str
    user_id: str
    type: str
    process_id: str
    process_number: str
    client_name: str
    date: datetime
    description: str | None
    status: DeadlineStatus
    days_until: int
    created_at: datetime
    updated_at: datetime


class DeadlineListResponse(BaseModel):
    deadlines: list[DeadlineResponse]
    total: int
    today_count: int
    week_count: int
    overdue_count: int


class DeadlineListParams(BaseModel):
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: DeadlineStatus | None = None
    process_id: str | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
