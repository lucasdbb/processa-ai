from fastapi import HTTPException, status

from src.core.config import settings
from src.core.email import load_email_template, send_email
from src.core.logging import logger
from src.core.supabase import get_supabase


class WaitlistService:
    def __init__(self):
        self.supabase = get_supabase()

    async def join(self, email: str, name: str | None, utm_source: str | None):
        # Check for existing entry
        try:
            existing = (
                self.supabase.table("waitlist")
                .select("id,status")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            if existing.data:
                return {"id": str(existing.data[0]["id"]), "status": "already_registered"}
        except Exception:
            pass

        # Insert new entry
        payload: dict[str, object] = {
            "email": email,
            "status": "pending",
        }
        if name:
            payload["name"] = name
        if utm_source:
            payload["utm_source"] = utm_source

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

        # Send welcome email (fire-and-forget)
        try:
            await self._send_welcome_email(email, name)
        except Exception:
            logger.warning(f"Failed to send waitlist welcome email to {email}")

        return {"id": str(record["id"]), "status": "registered"}

    async def count(self) -> int:
        try:
            res = self.supabase.table("waitlist").select("id", count="exact").execute()
            return res.count or 0
        except Exception:
            return 0

    async def _send_welcome_email(self, email: str, name: str | None):
        greeting = f"Olá, {name}!" if name else "Olá!"

        content = (
            f"{greeting}<br><br>"
            "Recebemos sua inscrição na lista de espera do Processa AI.<br><br>"
            "Estamos preparando algo especial para advogados como você. "
            "Assim que estiver pronto, você será um dos primeiros a saber.<br><br>"
            "Fique de olho no seu e-mail!"
        )

        html_body = load_email_template(
            "default.html",
            {
                "Titulo": "Você está na lista!",
                "Conteudo": content,
                "Botao_Texto": "Conheça nosso blog",
                "Botao_Link": f"{settings.FRONTEND_URL}/blog",
                "Rodape": "Vamos te avisar assim que o Processa AI estiver pronto.",
            },
        )

        plain_body = (
            f"{greeting}\n\n"
            "Recebemos sua inscrição na lista de espera do Processa AI.\n\n"
            "Estamos preparando algo especial para advogados como você. "
            "Assim que estiver pronto, você será um dos primeiros a saber.\n\n"
            "Fique de olho no seu e-mail!\n\n"
            "Atenciosamente,\nEquipe Processa AI"
        )

        await send_email(
            to_email=email,
            subject="Você está na lista! - Processa AI",
            body=plain_body,
            html_body=html_body if html_body else None,
        )
