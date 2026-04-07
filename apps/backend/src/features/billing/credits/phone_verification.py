"""
Phone verification service for anti-fraud credit claiming.
"""

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException

from src.core.db import get_pool
from src.core.logging import logger
from src.core.sms import normalize_phone_br, send_verification_code

MAX_ATTEMPTS_PER_CODE = 5
MAX_SMS_PER_HOUR = 3
CODE_TTL_MINUTES = 10


def _generate_code() -> str:
    """Generate a 6-digit OTP code."""
    return f"{secrets.randbelow(1000000):06d}"


def _normalize_and_validate_br_phone(phone: str) -> tuple[str, str]:
    """Return (normalized_with_country_code, local_digits) for BR phones."""
    normalized = normalize_phone_br(phone)

    if normalized.startswith("55"):
        local_digits = normalized[2:]
    else:
        local_digits = normalized

    if not local_digits.isdigit() or len(local_digits) not in (10, 11):
        raise HTTPException(status_code=400, detail="Número de telefone inválido")

    if not normalized.startswith("55"):
        normalized = f"55{local_digits}"

    return normalized, local_digits


async def send_phone_code(user_id: str, phone: str) -> dict:
    """
    Generate and send a verification code via SMS.

    Validations:
    - Phone format (10-11 digits BR)
    - Phone not already verified by another account
    - Rate limit: max 3 SMS/hour per phone number
    """
    normalized, digits_only = _normalize_and_validate_br_phone(phone)

    pool = await get_pool()
    async with pool.connection() as conn:
        # Check if phone is already verified by another user
        row = await conn.execute(
            """
            SELECT id FROM public.profiles
            WHERE phone = %s AND phone_verified = TRUE AND id != %s
            LIMIT 1
            """,
            (digits_only, user_id),
        )
        if await row.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Este telefone já está verificado em outra conta",
            )

        # Rate limit: max SMS per hour for this phone
        count_row = await conn.execute(
            """
            SELECT COUNT(*) FROM public.phone_verifications
            WHERE phone = %s
              AND created_at > now() - interval '1 hour'
            """,
            (normalized,),
        )
        (count,) = await count_row.fetchone()
        if count >= MAX_SMS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail="Limite de envios atingido. Tente novamente em alguns minutos.",
            )

        # Generate code and persist
        code = _generate_code()
        await conn.execute(
            """
            INSERT INTO public.phone_verifications (user_id, phone, code)
            VALUES (%s, %s, %s)
            """,
            (user_id, normalized, code),
        )

    # Send SMS (outside transaction — if SMS fails, the code row still exists
    # but will expire naturally. User can retry.)
    sent = await send_verification_code(normalized, code)
    if not sent:
        logger.error(f"Failed to send SMS to {normalized} for user {user_id}")
        raise HTTPException(
            status_code=502,
            detail="Falha ao enviar SMS. Verifique o número e tente novamente.",
        )

    return {"sent": True, "expires_in": CODE_TTL_MINUTES * 60}


async def verify_phone_code(user_id: str, phone: str, code: str) -> dict:
    """
    Verify a phone OTP code.

    Validations:
    - Code exists, not expired, not already verified
    - Max 5 attempts per code
    - Code matches
    """
    normalized, digits_only = _normalize_and_validate_br_phone(phone)
    code_clean = code.strip()
    if len(code_clean) != 6 or not code_clean.isdigit():
        raise HTTPException(status_code=400, detail="Código inválido")

    pool = await get_pool()
    async with pool.connection() as conn:
        # Find the most recent non-expired, non-verified code for this user+phone
        row = await conn.execute(
            """
            SELECT id, code, attempts
            FROM public.phone_verifications
            WHERE user_id = %s
              AND phone = %s
              AND verified = FALSE
              AND expires_at > now()
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user_id, normalized),
        )
        record = await row.fetchone()

        if not record:
            raise HTTPException(
                status_code=400,
                detail="Código expirado ou não encontrado. Solicite um novo código.",
            )

        verification_id, stored_code, attempts = record

        if attempts >= MAX_ATTEMPTS_PER_CODE:
            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas. Solicite um novo código.",
            )

        if code_clean != stored_code:
            # Increment attempts
            await conn.execute(
                """
                UPDATE public.phone_verifications
                SET attempts = attempts + 1
                WHERE id = %s
                """,
                (verification_id,),
            )
            remaining = MAX_ATTEMPTS_PER_CODE - attempts - 1
            raise HTTPException(
                status_code=400,
                detail=f"Código incorreto. {remaining} tentativa(s) restante(s).",
            )

        # Before confirming verification, ensure this phone is not verified by another account
        profile_row = await conn.execute(
            """
            SELECT id FROM public.profiles
            WHERE phone = %s
              AND phone_verified = TRUE
              AND id != %s
            LIMIT 1
            """,
            (digits_only, user_id),
        )
        if await profile_row.fetchone():
            raise HTTPException(
                status_code=409,
                detail="Este telefone já está verificado em outra conta",
            )

        # Persist phone verification on profile
        await conn.execute(
            """
            UPDATE public.profiles
            SET phone = %s,
                phone_verified = TRUE,
                phone_verified_at = %s
            WHERE id = %s
            """,
            (digits_only, datetime.now(timezone.utc), user_id),
        )

        # Code matches — mark verification row as verified
        await conn.execute(
            """
            UPDATE public.phone_verifications
            SET verified = TRUE
            WHERE id = %s
            """,
            (verification_id,),
        )

    return {"verified": True}


async def check_phone_verified(user_id: str, phone: str) -> bool:
    """
    Check if the given phone has been verified by this user
    (i.e., a verified record exists in phone_verifications).
    """
    normalized, _ = _normalize_and_validate_br_phone(phone)

    pool = await get_pool()
    async with pool.connection() as conn:
        row = await conn.execute(
            """
            SELECT 1 FROM public.phone_verifications
            WHERE user_id = %s
              AND phone = %s
              AND verified = TRUE
            LIMIT 1
            """,
            (user_id, normalized),
        )
        return await row.fetchone() is not None


async def mark_profile_phone_verified(user_id: str, phone: str) -> None:
    """
    Update the user's profile with verified phone info.
    Called after successful credit claim.
    """
    _, digits_only = _normalize_and_validate_br_phone(phone)

    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            """
            UPDATE public.profiles
            SET phone = %s,
                phone_verified = TRUE,
                phone_verified_at = %s
            WHERE id = %s
            """,
            (digits_only, datetime.now(timezone.utc), user_id),
        )
