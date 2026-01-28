from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ProcessStatus = Literal["active", "archived"]


class ProcessCreateRequest(BaseModel):
    number: str = Field(..., min_length=1, max_length=50)
    type: str = Field(..., min_length=1, max_length=255)
    court: str = Field(..., min_length=1, max_length=255)
    client_id: str
    defendant: str = Field(..., min_length=1, max_length=255)
    value: float = Field(..., ge=0)
    description: str | None = None


class ProcessUpdateRequest(BaseModel):
    number: str | None = Field(None, min_length=1, max_length=50)
    type: str | None = Field(None, min_length=1, max_length=255)
    court: str | None = Field(None, min_length=1, max_length=255)
    defendant: str | None = Field(None, min_length=1, max_length=255)
    value: float | None = Field(None, ge=0)
    description: str | None = None
    status: ProcessStatus | None = None


class ProcessResponse(BaseModel):
    id: str
    user_id: str
    number: str
    type: str
    court: str
    client_id: str
    client_name: str
    defendant: str
    value: float
    description: str | None
    status: ProcessStatus
    next_deadline: str | None
    created_at: datetime
    updated_at: datetime


class ProcessListResponse(BaseModel):
    processes: list[ProcessResponse]
    total: int


class ProcessListParams(BaseModel):
    search: str | None = None
    status: ProcessStatus | None = None
    client_id: str | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
