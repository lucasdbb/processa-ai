import base64
import hashlib
import hmac

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from src.core.auth import get_current_admin, verify_internal_token
from src.core.config import settings
from src.core.logging import logger
from src.features.core.notification_logs.service import notification_log_service


def _verify_twilio_signature(url: str, params: dict, signature: str) -> bool:
    """Verify Twilio X-Twilio-Signature using HMAC-SHA1."""
    if not settings.TWILIO_AUTH_TOKEN:
        logger.warning("TWILIO_AUTH_TOKEN not set, skipping signature verification")
        return True

    # Build the data string: URL + sorted POST params concatenated
    data = url
    for key in sorted(params.keys()):
        data += key + params[key]

    # HMAC-SHA1 with auth token
    computed = base64.b64encode(
        hmac.new(
            settings.TWILIO_AUTH_TOKEN.encode("utf-8"),
            data.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("utf-8")

    return hmac.compare_digest(computed, signature)

router = APIRouter()


@router.get("/logs")
async def list_notification_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    channel: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    _admin=Depends(verify_internal_token),
    _user=Depends(get_current_admin),
):
    """List notification logs (admin only)."""
    return await notification_log_service.list_logs(
        limit=limit,
        offset=offset,
        channel=channel,
        status=status,
        search=search,
    )


@router.get("/stats")
async def get_notification_stats(
    _admin=Depends(verify_internal_token),
    _user=Depends(get_current_admin),
):
    """Get notification statistics (admin only)."""
    return await notification_log_service.get_stats()


@router.post("/webhooks/twilio")
async def twilio_status_webhook(request: Request):
    """
    Twilio delivery status webhook.
    Receives status updates for WhatsApp messages.
    Verifies X-Twilio-Signature to prevent forged payloads.
    """
    try:
        form = await request.form()

        # Verify Twilio signature
        twilio_signature = request.headers.get("X-Twilio-Signature", "")
        request_url = str(request.url)
        form_params = {k: str(v) for k, v in form.items()}

        if not _verify_twilio_signature(request_url, form_params, twilio_signature):
            logger.warning("Invalid Twilio signature on webhook request")
            return JSONResponse(status_code=403, content={"detail": "Invalid signature"})

        message_sid = form.get("MessageSid")
        message_status = form.get("MessageStatus")
        error_code = form.get("ErrorCode")

        if not message_sid or not message_status:
            return JSONResponse(status_code=400, content={"detail": "Missing fields"})

        # Map Twilio statuses to our statuses
        status_map = {
            "queued": "queued",
            "sent": "sent",
            "delivered": "delivered",
            "read": "read",
            "failed": "failed",
            "undelivered": "failed",
        }
        mapped_status = status_map.get(message_status, message_status)
        error_msg = f"Twilio error code: {error_code}" if error_code else None

        await notification_log_service.update_status(
            external_id=str(message_sid),
            status=mapped_status,
            error_message=error_msg,
        )

        logger.info(f"Twilio webhook: SID={message_sid}, status={mapped_status}")
        return JSONResponse(status_code=200, content={"status": "ok"})

    except Exception as e:
        logger.error(f"Error processing Twilio webhook: {e}")
        return JSONResponse(status_code=500, content={"detail": "Internal error"})
