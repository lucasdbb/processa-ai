from typing import Optional

from pydantic import BaseModel, EmailStr


class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    utm_source: Optional[str] = None


class WaitlistResponse(BaseModel):
    id: str
    status: str


class WaitlistCountResponse(BaseModel):
    count: int
