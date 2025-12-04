"""
User schemas (Pydantic models)
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr


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
    confirmed_at: str | None = None  # Data de confirmação do email
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfile(BaseModel):
    """Update profile schema"""

    name: str | None = None  # Será mapeado para full_name internamente
    avatar_url: str | None = None
    phone: str | None = None
    documentType: str | None = None
    documentNumber: str | None = None


class UpdateRoleRequest(BaseModel):
    userId: str
    role: str
