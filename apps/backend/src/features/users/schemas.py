"""
User schemas (Pydantic models)
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict


class UserProfile(BaseModel):
    """User profile schema"""

    id: str
    email: EmailStr
    name: str  # Nome do usuário (mapeado de full_name internamente)
    role: str = "user"
    avatar_url: str | None = None
    phone: str | None = None
    document_type: str | None = None
    document_number: str | None = None
    newsletter_opt_in: bool = False  # Status da assinatura da newsletter
    confirmed_at: str | None = None  # Data de confirmação do email
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfile(BaseModel):
    """Update profile schema"""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None  # Será mapeado para full_name internamente
    avatar_url: str | None = None
    phone: str | None = None
    document_type: str | None = Field(default=None, alias="documentType")
    document_number: str | None = Field(default=None, alias="documentNumber")
    newsletter_opt_in: bool | None = None


class UpdateRoleRequest(BaseModel):
    userId: str
    role: str
