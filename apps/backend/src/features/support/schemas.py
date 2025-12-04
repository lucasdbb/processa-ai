from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class SupportContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: str
    contactPreference: Literal['email', 'telefone', 'whatsapp']
    message: str
    isClient: bool = False
    consent: bool


class SupportContactResponse(BaseModel):
    id: str
    status: str
