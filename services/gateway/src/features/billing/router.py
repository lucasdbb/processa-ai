"""Billing API proxy router - Routes requests to the Billing API microservice."""

from fastapi import APIRouter, Depends, Query, Request

from src.core.auth import get_current_user
from src.core.config import settings
from src.core.proxy import proxy_request

router = APIRouter()


@router.post("/checkout")
async def create_checkout(request: Request, user=Depends(get_current_user)):
    """Create a Stripe Checkout session for subscription."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.BILLING_API_BASE_URL,
        internal_token=settings.BILLING_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/subscriptions/checkout",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.get("/portal")
async def get_portal(user=Depends(get_current_user)):
    """Get Stripe Customer Portal URL."""
    return await proxy_request(
        base_url=settings.BILLING_API_BASE_URL,
        internal_token=settings.BILLING_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/subscriptions/portal",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.get("/subscription")
async def get_subscription(user=Depends(get_current_user)):
    """Get current subscription status."""
    return await proxy_request(
        base_url=settings.BILLING_API_BASE_URL,
        internal_token=settings.BILLING_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/subscriptions/subscription",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.get("/invoices")
async def list_invoices(
    limit: int = Query(10, ge=1, le=100),
    user=Depends(get_current_user),
):
    """List user's invoices."""
    return await proxy_request(
        base_url=settings.BILLING_API_BASE_URL,
        internal_token=settings.BILLING_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/subscriptions/invoices",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params={"limit": limit},
    )


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Forward Stripe webhooks to Billing API.

    This endpoint does NOT require authentication - Stripe calls it directly.
    The Billing API will verify the Stripe signature.
    """
    import httpx
    from fastapi import HTTPException, status

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.BILLING_API_BASE_URL}/api/v1/webhooks/stripe",
                content=payload,
                headers={
                    "Content-Type": "application/json",
                    "stripe-signature": signature,
                },
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Erro de conexão com o serviço de billing",
        )

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Webhook error")

    return resp.json()
