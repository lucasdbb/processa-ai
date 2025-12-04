import secrets
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status

from src.core.config import settings
from src.shared.database import get_supabase


class NewsletterService:
    def __init__(self):
        self.supabase = get_supabase()

    async def subscribe(
        self,
        email: str,
        topics: list[str] | None,
        channel: str,
        consent: bool,
        user_id: str | None,
    ):
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Consentimento necessário",
            )
        token = secrets.token_urlsafe(32)
        payload = {
            "user_id": user_id,
            "email": email,
            "topics": topics,
            "channel": channel,
            "consent": consent,
            "confirmation_token": token,
            "status": "pending",
        }
        try:
            res = self.supabase.table("newsletter_subscriptions").insert(payload).execute()
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

        try:
            if settings.SENDGRID_API_KEY:
                confirm_url = f"{settings.FRONTEND_URL}/blog?newsletter_token={token}"
                subject = "Confirme sua assinatura de notícias jurídicas"
                body = (
                    f"Confirme sua assinatura clicando no link:\n{confirm_url}\n\n"
                    f"Se você não solicitou esta assinatura, ignore este e-mail."
                )
                payload_email = {
                    "personalizations": [
                        {"to": [{"email": email}], "subject": subject}
                    ],
                    "from": {"email": settings.SENDGRID_FROM or settings.ADMIN_EMAIL or email},
                    "content": [{"type": "text/plain", "value": body}],
                }
                headers = {
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                }
                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        json=payload_email,
                        headers=headers,
                    )
        except Exception:
            pass

        return {"id": str(record.get("id")), "status": "pending"}

    async def confirm(self, token: str):
        try:
            table = self.supabase.table("newsletter_subscriptions")
            res = table.select("id,status").eq("confirmation_token", token).limit(1).execute()
            data = res.data or []
            if not data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
            sub_id = data[0]["id"]
            now = datetime.now(timezone.utc).isoformat()
            upd = table.update({
                "status": "subscribed",
                "confirmed_at": now,
                "confirmation_token": None,
            }).eq("id", sub_id).execute()
            if not upd.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Falha ao confirmar",
                )
            return {"id": str(sub_id), "status": "subscribed"}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao confirmar",
            )

    async def update_preferences(
        self,
        user_id: str,
        topics: list[str] | None,
    ):
        try:
            updates: dict[str, object] = {}
            if topics is not None:
                updates["topics"] = topics
            if not updates:
                return {"updated": False}
            table = self.supabase.table("newsletter_subscriptions")
            res = table.update(updates).eq("user_id", user_id).eq("status", "subscribed").execute()
            return {"updated": bool(res.data)}
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar",
            )

    async def unsubscribe(self, token: str):
        try:
            table = self.supabase.table("newsletter_subscriptions")
            res = table.select("id").eq("confirmation_token", token).limit(1).execute()
            data = res.data or []
            if not data:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token inválido")
            sub_id = data[0]["id"]
            now = datetime.now(timezone.utc).isoformat()
            upd = table.update({
                "status": "unsubscribed",
                "unsubscribed_at": now,
            }).eq("id", sub_id).execute()
            if not upd.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Falha ao cancelar",
                )
            return {"id": str(sub_id), "status": "unsubscribed"}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao cancelar",
            )
