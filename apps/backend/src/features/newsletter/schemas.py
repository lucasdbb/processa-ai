from typing import Literal, Optional

from pydantic import BaseModel, EmailStr


class SubscribeRequest(BaseModel):
    email: EmailStr
    topics: Optional[list[str]] = None
    channel: Literal['email'] = 'email'
    consent: bool


class SubscribeResponse(BaseModel):
    id: str
    status: str


class ConfirmRequest(BaseModel):
    token: str


class PreferencesUpdate(BaseModel):
    topics: Optional[list[str]] = None


class UnsubscribeRequest(BaseModel):
    token: str
