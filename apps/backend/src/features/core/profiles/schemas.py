import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator
from pydantic.config import ConfigDict


def validate_cpf(cpf: str) -> bool:
    """Validate Brazilian CPF."""
    if not cpf:
        return True  # Allow empty CPF

    # Remove non-digits
    cpf_digits = re.sub(r"\D", "", cpf)

    # Check length
    if len(cpf_digits) != 11:
        return False

    # Check if all digits are the same
    if cpf_digits == cpf_digits[0] * 11:
        return False

    # Validate first check digit
    sum_val = 0
    for i in range(9):
        sum_val += int(cpf_digits[i]) * (10 - i)
    digit1 = 11 - (sum_val % 11)
    if digit1 >= 10:
        digit1 = 0
    if digit1 != int(cpf_digits[9]):
        return False

    # Validate second check digit
    sum_val = 0
    for i in range(10):
        sum_val += int(cpf_digits[i]) * (11 - i)
    digit2 = 11 - (sum_val % 11)
    if digit2 >= 10:
        digit2 = 0
    if digit2 != int(cpf_digits[10]):
        return False

    return True


def validate_phone(phone: str) -> bool:
    """Validate Brazilian phone number."""
    if not phone:
        return True  # Allow empty phone

    # Remove non-digits
    phone_digits = re.sub(r"\D", "", phone)

    # Brazilian phone must have 10 or 11 digits (with DDD)
    return len(phone_digits) in (10, 11)


class UserCredits(BaseModel):
    """User credits breakdown by type"""

    subscription: int = 0  # Available subscription credits
    purchased: int = 0  # Available purchased credits
    total: int = 0  # Total available credits


class UserProfile(BaseModel):
    """User profile schema"""

    id: str
    email: EmailStr
    name: str
    role: str = "user"
    status: str = "active"
    avatar_url: str | None = None
    phone: str | None = None
    cpf: str | None = None
    newsletter_opt_in: bool = False
    whatsapp_opt_in: bool = False
    welcome_credits_claimed: bool = False
    has_used_ai_tool: bool = False
    has_used_calculator: bool = False
    checklist_dismissed: bool = False
    checklist_bonus_claimed: bool = False
    confirmed_at: str | None = None
    created_at: datetime
    credits: UserCredits | None = None
    plan_id: str | None = None
    subscription_status: str | None = None

    class Config:
        from_attributes = True


class UpdateProfile(BaseModel):
    """Update profile schema"""

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    avatar_url: str | None = None
    phone: str | None = None
    cpf: str  # CPF é obrigatório
    company: str | None = None
    bio: str | None = None
    newsletter_opt_in: bool | None = None
    whatsapp_opt_in: bool | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf_field(cls, v: str) -> str:
        """Validate CPF format and check digit."""
        if not v or v.strip() == "":
            raise ValueError("CPF é obrigatório")
        if not validate_cpf(v):
            raise ValueError("CPF inválido")
        # Return only digits
        return re.sub(r"\D", "", v)

    @field_validator("phone")
    @classmethod
    def validate_phone_field(cls, v: str | None) -> str | None:
        """Validate phone format."""
        if v is None or v.strip() == "":
            return None
        if not validate_phone(v):
            raise ValueError("Telefone inválido. Deve conter 10 ou 11 dígitos.")
        # Return only digits
        return re.sub(r"\D", "", v)


class UpdateOnboarding(BaseModel):
    """Update onboarding flags (only allows setting to True)."""

    has_used_ai_tool: bool | None = None
    has_used_calculator: bool | None = None
    checklist_dismissed: bool | None = None


class UpdateRoleRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    role: str
    subscription_credits: int | None = Field(
        None, ge=0, description="Subscription credits", alias="subscriptionCredits"
    )
    purchased_credits: int | None = Field(
        None, ge=0, description="Purchased credits", alias="purchasedCredits"
    )
    plan_id: str | None = Field(
        None, description="Plan ID (free, student, autonomo)", alias="planId"
    )

    # Legacy field for backward compatibility
    credits: int | None = Field(None, ge=0, description="[DEPRECATED] Use subscription_credits")


class UpdateStatusRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str = Field(alias="userId")
    status: str


class AddCreditsRequest(BaseModel):
    """Request to add credits to a user"""

    amount: int = Field(..., gt=0, description="Amount of credits to add (must be positive)")


class UpdatePlanRequest(BaseModel):
    """Request to update user's plan"""

    model_config = ConfigDict(populate_by_name=True)

    plan_id: str = Field(..., description="Plan ID (free, student, autonomo)")
