from datetime import datetime

from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict


class UserProfile(BaseModel):
    """User profile schema"""

    id: str
    email: EmailStr
    name: str
    role: str = "user"
    avatar_url: str | None = None
    phone: str | None = None
    cpf: str | None = None
    newsletter_opt_in: bool = False
    confirmed_at: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfile(BaseModel):
    """Update profile schema"""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    cpf: str | None = None
    newsletter_opt_in: bool | None = None


class UpdateRoleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    role: str


class UpdateStatusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    status: str
