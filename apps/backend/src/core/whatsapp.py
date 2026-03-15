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
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_WHATSAPP_FROM
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


async def send_whatsapp(to_phone: str, body: str) -> bool:
    """
    Send a WhatsApp message via Twilio.

    Args:
        to_phone: Recipient phone number (any Brazilian format)
        body: Message text

    Returns:
        True if sent successfully, False otherwise.
        Returns False silently if Twilio is not configured.
    """
    if not is_whatsapp_configured():
        return False

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
                },
            )

            if response.status_code in (200, 201):
                logger.info(f"WhatsApp sent to {to_formatted}")
                return True
            else:
                logger.error(f"Twilio error: {response.status_code} - {response.text}")
                return False

    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {to_formatted}: {e}")
        return False


async def send_deadline_whatsapp(
    to_phone: str,
    user_name: str | None,
    deadlines: list[dict],
) -> bool:
    """
    Send a consolidated WhatsApp message about urgent deadlines (vence hoje ou amanha).

    Each item in deadlines should have: title, days_until, due_date_str.
    Returns False silently if Twilio is not configured.
    """
    if not is_whatsapp_configured():
        return False

    if not deadlines:
        return False

    name = user_name or "Advogado(a)"
    lines = []
    for d in deadlines:
        if d["days_until"] == 0:
            lines.append(f"  *HOJE* - {d['title']} ({d['due_date_str']})")
        else:
            lines.append(f"  *Amanha* - {d['title']} ({d['due_date_str']})")

    deadlines_text = "\n".join(lines)

    body = (
        f"Ola {name}! Voce tem prazo(s) urgente(s):\n\n"
        f"{deadlines_text}\n\n"
        f"Acesse: {settings.FRONTEND_URL}/app/calendario"
    )

    return await send_whatsapp(to_phone, body)
