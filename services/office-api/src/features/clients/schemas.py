from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


ClientStatus = Literal["active", "archived"]


class ClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    cpf: str = Field(..., pattern=r"^\d{3}\.\d{3}\.\d{3}-\d{2}$")
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None


class ClientUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    cpf: str | None = Field(None, pattern=r"^\d{3}\.\d{3}\.\d{3}-\d{2}$")
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None
    status: ClientStatus | None = None


class ClientResponse(BaseModel):
    id: str
    user_id: str
    name: str
    cpf: str
    phone: str | None
    email: str | None
    address: str | None
    notes: str | None
    status: ClientStatus
    processes_count: int
    calculations_count: int
    last_activity: datetime | None
    created_at: datetime
    updated_at: datetime


class ClientListResponse(BaseModel):
    clients: list[ClientResponse]
    total: int


class ClientListParams(BaseModel):
    search: str | None = None
    status: ClientStatus | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
