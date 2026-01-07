"""
Authentication schemas (Pydantic models)
"""

from pydantic import BaseModel, EmailStr, Field
from pydantic.config import ConfigDict


class UserRegister(BaseModel):
    """User registration schema"""

    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str | None = Field(default=None, alias="name")


class UserLogin(BaseModel):
    """User login schema"""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response schema - returned when user is auto-confirmed"""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class EmailConfirmationResponse(BaseModel):
    """Email confirmation response - returned when email confirmation is required"""

    message: str
    email_confirmation_required: bool
    user: dict


class ForgotPassword(BaseModel):
    """Forgot password schema"""

    email: EmailStr


class ResetPassword(BaseModel):
    """Reset password schema"""

    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(..., alias="access_token")
    new_password: str = Field(..., min_length=8, max_length=100, alias="password")
