from fastapi import HTTPException, status

from src.core.config import settings
from src.core.email import send_email
from src.core.supabase import get_supabase
from src.features.core.support.schemas import SupportContactRequest


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

        # Send notification email if configured
        try:
            if settings.SUPPORT_EMAIL:
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

                await send_email(
                    to_email=settings.SUPPORT_EMAIL,
                    subject=f"Novo contato: {data.subject}",
                    body=body,
                )
        except Exception:
            # Silently ignore email failures; the request is saved already
            pass

        return {"id": str(record.get("id")), "status": "open"}

    async def report_error(self, data) -> dict:
        """Send a frontend crash report to the admin via email."""
        from src.core.logging import logger

        admin_email = "admin@processai.app.br"

        body = (
            "Erro critico capturado no frontend\n"
            "\n"
            f"Mensagem:      {data.error_message}\n"
            f"Rota:          {data.route or '-'}\n"
            f"User-Agent:    {data.user_agent or '-'}\n"
            f"Usuario ID:    {data.user_id or 'nao autenticado'}\n"
            f"Usuario email: {data.user_email or '-'}\n"
        )

        if data.component_stack:
            body += f"\nComponent stack:\n{data.component_stack}\n"

        try:
            if admin_email:
                subject = f"[Processa AI] Erro critico — {data.error_message[:80]}"
                await send_email(to_email=admin_email, subject=subject, body=body)
        except Exception as e:
            logger.warning(f"Error report email failed: {e}")

        return {"received": True}
