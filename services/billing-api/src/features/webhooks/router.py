from fastapi import APIRouter, Request

from src.features.webhooks.schemas import WebhookResponse
from src.features.webhooks.service import webhooks_service

router = APIRouter()


@router.post("/stripe", response_model=WebhookResponse)
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhooks.

    This endpoint does NOT require internal token authentication.
    Stripe calls it directly and authentication is done via
    Stripe signature verification using the webhook secret.
    """
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    return await webhooks_service.handle_webhook(payload, signature)
