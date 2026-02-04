from fastapi import APIRouter, Depends, Query

from src.core.auth import get_user_id, verify_internal_token
from src.features.billing.subscriptions.schemas import (
    CheckoutResponse,
    CreateCheckoutRequest,
    InvoiceListResponse,
    PortalResponse,
    SubscriptionStatus,
    SyncResponse,
)
from src.features.billing.subscriptions.service import subscriptions_service

router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    data: CreateCheckoutRequest,
    user_id: str = Depends(get_user_id),
):
    """Create a Stripe Checkout session for subscription."""
    return await subscriptions_service.create_checkout_session(
        user_id=user_id,
        price_id=data.price_id,
        success_url=data.success_url,
        cancel_url=data.cancel_url,
    )


@router.get("/portal", response_model=PortalResponse)
async def get_portal(user_id: str = Depends(get_user_id)):
    """Get Stripe Customer Portal URL."""
    return await subscriptions_service.create_portal_session(user_id)


@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription(user_id: str = Depends(get_user_id)):
    """Get current subscription status."""
    return await subscriptions_service.get_subscription(user_id)


@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    limit: int = Query(10, ge=1, le=100),
    user_id: str = Depends(get_user_id),
):
    """List user's invoices."""
    return await subscriptions_service.list_invoices(user_id, limit=limit)


@router.post("/sync", response_model=SyncResponse)
async def sync_subscription(user_id: str = Depends(get_user_id)):
    """
    Sync local subscription state with Stripe.

    Use this endpoint to reconcile data after webhook failures
    or when subscription state seems out of sync.
    """
    return await subscriptions_service.sync_subscription(user_id)
