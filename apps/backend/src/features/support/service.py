import httpx
from fastapi import HTTPException, status

from src.core.config import settings
from src.shared.database import get_supabase
from src.features.support.schemas import SupportContactRequest


class SupportService:
    def __init__(self):
        self.supabase = get_supabase()

    async def submit_request(self, data: SupportContactRequest):
        if not data.consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Consentimento necessário",
            )

        payload = {
            "name": data.name,
            "email": data.email,
            "phone": data.phone,
            "company": data.company,
            "subject": data.subject,
            "contact_preference": data.contactPreference,
            "message": data.message,
            "is_client": data.isClient,
            "consent": data.consent,
            "status": "open",
        }

        try:
            insert_res = self.supabase.table("support_requests").insert(payload).execute()
            if not insert_res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Falha ao salvar solicitação",
                )
            record = insert_res.data[0]
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao salvar solicitação",
            )

        # Send notification email via SendGrid if configured
        try:
            if settings.ADMIN_EMAIL and settings.SENDGRID_API_KEY:
                body = (
                    f"Nome: {data.name}\n"
                    f"Email: {data.email}\n"
                    f"Telefone: {data.phone or ''}\n"
                    f"Empresa: {data.company or ''}\n"
                    f"Preferência: {data.contactPreference}\n"
                    f"Cliente: {'sim' if data.isClient else 'não'}\n\n"
                    f"Mensagem:\n{data.message}\n\n"
                    f"ID: {record.get('id')}\n"
                )

                payload = {
                    "personalizations": [
                        {
                            "to": [{"email": settings.ADMIN_EMAIL}],
                            "subject": f"Novo contato: {data.subject}",
                        }
                    ],
                    "from": {"email": settings.SENDGRID_FROM or settings.ADMIN_EMAIL},
                    "content": [{"type": "text/plain", "value": body}],
                }

                headers = {
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                }

                async with httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        json=payload,
                        headers=headers,
                    )
        except Exception:
            # Silently ignore email failures; the request is saved already
            pass

        return {"id": str(record.get("id")), "status": "open"}
