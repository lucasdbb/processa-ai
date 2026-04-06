from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CreateCheckoutRequest(BaseModel):
    price_id: str
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionStatus(BaseModel):
    id: str
    user_id: str
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    plan_id: str
    status: Literal["active", "past_due", "canceled", "incomplete", "incomplete_expired", "trialing", "paused", "none"]
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancel_at_period_end: bool = False


class InvoiceItem(BaseModel):
    id: str
    amount: int
    currency: str
    status: str
    created: datetime
    invoice_url: str | None = None
    invoice_pdf: str | None = None


class InvoiceListResponse(BaseModel):
    invoices: list[InvoiceItem]
    has_more: bool


class ChangePlanRequest(BaseModel):
    price_id: str


class ActionResponse(BaseModel):
    success: bool


class RetryPaymentResponse(BaseModel):
    success: bool
    already_paid: bool = False


class SyncResponse(BaseModel):
    synced: bool
    message: str | None = None
    plan_id: str | None = None
    status: str | None = None
    current_period_end: str | None = None
