from typing import Optional

from pydantic import BaseModel, EmailStr


class WaitlistRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    utm_source: Optional[str] = None
    ref_code: Optional[str] = None


class WaitlistResponse(BaseModel):
    id: str
    status: str
    referral_code: Optional[str] = None
    referral_link: Optional[str] = None


class WaitlistCountResponse(BaseModel):
    count: int
