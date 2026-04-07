"""
SMS service using Brevo Transactional SMS API.
"""

import httpx

from src.core.config import settings
from src.core.logging import logger

BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"
SMS_SENDER = "Processa AI"


def _resolve_sms_api_key() -> str:
    """Resolve Brevo API key (same key used for email)."""
    return (settings.BREVO_API_KEY or "").strip()


def normalize_phone_br(phone: str) -> str:
    """
    Normalize a Brazilian phone to international format without '+'.

    Accepts: 11999999999, (11) 99999-9999, +5511999999999, 5511999999999
    Returns: 5511999999999
    """
    digits = "".join(c for c in phone if c.isdigit())

    if digits.startswith("55") and len(digits) >= 12:
        return digits

    if len(digits) in (10, 11):
        return f"55{digits}"

    return digits


async def send_sms(to_phone: str, content: str) -> bool:
    """
    Send an SMS via Brevo Transactional SMS API.

    Args:
        to_phone: Recipient phone in any Brazilian format
        content: SMS text content (max 160 chars recommended)

    Returns:
        True if sent successfully, False otherwise
    """
    api_key = _resolve_sms_api_key()
    if not api_key:
        logger.warning("Brevo API key not configured, skipping SMS")
        return False

    recipient = normalize_phone_br(to_phone)
    if len(recipient) < 12:
        logger.error(f"Invalid phone number after normalization: {to_phone} -> {recipient}")
        return False

    payload = {
        "sender": SMS_SENDER,
        "recipient": recipient,
        "content": content,
        "type": "transactional",
    }

    headers = {
        "api-key": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                BREVO_SMS_URL,
                json=payload,
                headers=headers,
            )
            if 200 <= response.status_code < 300:
                logger.info(f"SMS sent to {recipient}")
                return True
            else:
                logger.error(f"Brevo SMS error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send SMS to {recipient}: {e}")
        return False


async def send_verification_code(to_phone: str, code: str) -> bool:
    """Send a phone verification OTP code via SMS."""
    content = f"Seu codigo Processa AI: {code}. Valido por 10 minutos."
    return await send_sms(to_phone, content)
