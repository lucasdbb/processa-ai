from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class SupportContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    subject: str
    contactPreference: Literal["email", "telefone", "whatsapp"]
    message: str
    isClient: bool = False
    consent: bool


class SupportContactResponse(BaseModel):
    id: str
    status: str


class ErrorReportRequest(BaseModel):
    error_message: str
    component_stack: Optional[str] = None
    route: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None


class ErrorReportResponse(BaseModel):
    received: bool
