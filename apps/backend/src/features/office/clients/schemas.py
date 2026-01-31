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
    limit: int = 50
    offset: int = 0

    search: str | None = None
    status: ClientStatus | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
