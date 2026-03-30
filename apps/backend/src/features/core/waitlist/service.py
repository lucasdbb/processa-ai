import secrets
import string
import uuid

from fastapi import HTTPException, status

from src.core.config import settings
from src.core.email import load_email_template, send_email
from src.core.logging import logger
from src.core.supabase import get_supabase

REFERRAL_CODE_PREFIX = "PROC-"
REFERRAL_CODE_LENGTH = 6


class WaitlistService:
    def __init__(self):
        self.supabase = get_supabase()

    def _generate_referral_code(self) -> str:
        chars = string.ascii_uppercase + string.digits
        for _ in range(5):
            code = REFERRAL_CODE_PREFIX + "".join(
                secrets.choice(chars) for _ in range(REFERRAL_CODE_LENGTH)
            )
            existing = (
                self.supabase.table("waitlist")
                .select("id")
                .eq("referral_code", code)
                .limit(1)
                .execute()
            )
            if not existing.data:
                return code
        return REFERRAL_CODE_PREFIX + uuid.uuid4().hex[:REFERRAL_CODE_LENGTH].upper()

    def _build_referral_link(self, referral_code: str) -> str:
        return f"{settings.FRONTEND_URL}?ref={referral_code}"

    async def join(
        self,
        email: str,
        name: str | None,
        utm_source: str | None,
        ref_code: str | None = None,
    ):
        # Check for existing entry
        try:
            existing = (
                self.supabase.table("waitlist")
                .select("id,status,referral_code")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            if existing.data:
                entry = existing.data[0]
                referral_code = entry.get("referral_code")

                # Generate referral code for old entries that don't have one
                if not referral_code:
                    referral_code = self._generate_referral_code()
                    self.supabase.table("waitlist").update(
                        {"referral_code": referral_code}
                    ).eq("id", entry["id"]).execute()

                return {
                    "id": str(entry["id"]),
                    "status": "already_registered",
                    "referral_code": referral_code,
                    "referral_link": self._build_referral_link(referral_code),
                }
        except Exception:
            pass

        # Resolve referrer from ref_code
        referred_by = None
        if ref_code:
            try:
                ref_result = (
                    self.supabase.table("waitlist")
                    .select("id")
                    .eq("referral_code", ref_code)
                    .limit(1)
                    .execute()
                )
                if ref_result.data:
                    referred_by = str(ref_result.data[0]["id"])
            except Exception:
                pass

        # Generate referral code for new entry
        referral_code = self._generate_referral_code()

        # Insert new entry
        payload: dict[str, object] = {
            "email": email,
            "status": "pending",
            "referral_code": referral_code,
        }
        if name:
            payload["name"] = name
        if utm_source:
            payload["utm_source"] = utm_source
        if referred_by:
            payload["referred_by"] = referred_by

        try:
            res = self.supabase.table("waitlist").insert(payload).execute()
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Falha ao salvar",
                )
            record = res.data[0]
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar",
            )

        referral_link = self._build_referral_link(referral_code)

        # Send welcome email (fire-and-forget)
        try:
            await self._send_welcome_email(email, name, referral_code, referral_link)
        except Exception:
            logger.warning(f"Failed to send waitlist welcome email to {email}")

        return {
            "id": str(record["id"]),
            "status": "registered",
            "referral_code": referral_code,
            "referral_link": referral_link,
        }

    async def count(self) -> int:
        try:
            res = self.supabase.table("waitlist").select("id", count="exact").execute()
            return res.count or 0
        except Exception:
            return 0

    async def _send_welcome_email(
        self,
        email: str,
        name: str | None,
        referral_code: str,
        referral_link: str,
    ):
        greeting = f"Olá, {name}!" if name else "Olá!"

        html_body = load_email_template(
            "waitlist.html",
            {
                "Titulo": "Você está na lista!",
                "Subtitulo": "Sua vaga foi garantida na lista de espera.",
                "Mensagem": (
                    f"{greeting}<br><br>"
                    "Recebemos sua inscrição na lista de espera do Processa AI.<br><br>"
                    "Estamos preparando algo especial para advogados como você. "
                    "Assim que estiver pronto, você será um dos primeiros a saber."
                ),
                "Codigo": referral_code,
                "Link": referral_link,
            },
        )

        body = (
            f"{greeting}\n\n"
            "Recebemos sua inscrição na lista de espera do Processa AI.\n\n"
            "Estamos preparando algo especial para advogados como você. "
            "Assim que estiver pronto, você será um dos primeiros a saber.\n\n"
            "---\n\n"
            "PROMOÇÃO DE PRÉ-LANÇAMENTO: INDIQUE E GANHE!\n\n"
            f"Seu código de indicação: {referral_code}\n"
            f"Seu link exclusivo: {referral_link}\n\n"
            "Para cada pessoa que assinar a plataforma usando seu link, "
            "você ganha 5 créditos para usar nos recursos de IA.\n\n"
            "Atenciosamente,\nEquipe Processa AI"
        )

        await send_email(
            to_email=email,
            subject="Você está na lista! - Processa AI",
            body=body,
            html_body=html_body if html_body else None,
        )
