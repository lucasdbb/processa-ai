"""
WhatsApp notification service via Twilio.
Only sends messages if Twilio env vars are configured.
"""

import httpx

from src.core.config import settings
from src.core.logging import logger

TWILIO_MESSAGES_URL = (
    f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
)


def is_whatsapp_configured() -> bool:
    """Check if all required Twilio WhatsApp env vars are set."""
    return bool(
        settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_FROM
    )


def _format_whatsapp_number(phone: str) -> str:
    """
    Normalize a Brazilian phone number to WhatsApp format.
    Accepts: +5511999999999, 5511999999999, 11999999999, (11) 99999-9999, etc.
    Returns: whatsapp:+5511999999999
    """
    digits = "".join(c for c in phone if c.isdigit())

    if digits.startswith("55") and len(digits) >= 12:
        return f"whatsapp:+{digits}"

    if len(digits) == 11:
        return f"whatsapp:+55{digits}"

    if len(digits) == 10:
        return f"whatsapp:+55{digits}"

    return f"whatsapp:+{digits}"


class WhatsAppResult:
    """Result of a WhatsApp send attempt."""

    def __init__(self, success: bool, sid: str | None = None, error: str | None = None):
        self.success = success
        self.sid = sid
        self.error = error


async def send_whatsapp(to_phone: str, body: str) -> WhatsAppResult:
    """
    Send a WhatsApp message via Twilio.

    Returns WhatsAppResult with success status and Twilio SID for tracking.
    Returns failure silently if Twilio is not configured.
    """
    if not is_whatsapp_configured():
        return WhatsAppResult(success=False, error="Twilio not configured")

    to_formatted = _format_whatsapp_number(to_phone)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                TWILIO_MESSAGES_URL,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={
                    "From": settings.TWILIO_WHATSAPP_FROM,
                    "To": to_formatted,
                    "Body": body,
                    "StatusCallback": f"{settings.FRONTEND_URL.replace('localhost:5173', 'localhost:8000')}/api/notification-logs/webhooks/twilio",
                },
            )

            if response.status_code in (200, 201):
                data = response.json()
                sid = data.get("sid")
                logger.info(f"WhatsApp sent to {to_formatted} (SID: {sid})")
                return WhatsAppResult(success=True, sid=sid)
            else:
                error = f"Twilio error: {response.status_code} - {response.text}"
                logger.error(error)
                return WhatsAppResult(success=False, error=error)

    except Exception as e:
        error = f"Failed to send WhatsApp to {to_formatted}: {e}"
        logger.error(error)
        return WhatsAppResult(success=False, error=str(e))


async def send_deadline_whatsapp(
    to_phone: str,
    user_name: str | None,
    deadlines: list[dict],
) -> WhatsAppResult:
    """
    Send a consolidated WhatsApp message about urgent deadlines.

    Each item in deadlines should have: title, days_until, due_date_str.
    Returns WhatsAppResult with success status and Twilio SID.
    """
    if not is_whatsapp_configured():
        return WhatsAppResult(success=False, error="Twilio not configured")

    if not deadlines:
        return WhatsAppResult(success=False, error="No deadlines")

    name = user_name or "Advogado(a)"
    lines = []
    for d in deadlines:
        if d["days_until"] == 0:
            lines.append(f"  *HOJE* - {d['title']} ({d['due_date_str']})")
        else:
            lines.append(f"  *Amanhã* - {d['title']} ({d['due_date_str']})")

    deadlines_text = "\n".join(lines)

    body = (
        f"Olá {name}! Você tem prazo(s) urgente(s):\n\n"
        f"{deadlines_text}\n\n"
        f"Acesse: {settings.FRONTEND_URL}/app/calendario"
    )

    return await send_whatsapp(to_phone, body)
