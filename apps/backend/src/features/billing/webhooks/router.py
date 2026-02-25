from fastapi import APIRouter, HTTPException, Request

from src.features.billing.webhooks.schemas import WebhookResponse
from src.features.billing.webhooks.service import webhooks_service

router = APIRouter()


@router.post("/stripe", response_model=WebhookResponse)
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhooks.

    This endpoint does NOT require internal token authentication.
    Stripe calls it directly and authentication is done via
    Stripe signature verification using the webhook secret.
    """
    try:
        payload = await request.body()
        signature = request.headers.get("stripe-signature", "")
        return await webhooks_service.handle_webhook(payload, signature)
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        from src.core.logging import logger

        logger.error(f"Unhandled error in stripe_webhook endpoint: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
