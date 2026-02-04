"""
Email service using SendGrid.
"""

import httpx

from src.core.config import settings
from src.core.logging import logger

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    from_email: str | None = None,
) -> bool:
    """
    Send an email using SendGrid.

    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
        from_email: Optional sender email (defaults to SENDGRID_FROM)

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not settings.SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured, skipping email")
        return False

    sender = from_email or settings.SENDGRID_FROM or settings.ADMIN_EMAIL
    if not sender:
        logger.warning("No sender email configured, skipping email")
        return False

    content = [{"type": "text/plain", "value": body}]
    if html_body:
        content.append({"type": "text/html", "value": html_body})

    payload = {
        "personalizations": [
            {
                "to": [{"email": to_email}],
                "subject": subject,
            }
        ],
        "from": {"email": sender},
        "content": content,
    }

    headers = {
        "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                SENDGRID_API_URL,
                json=payload,
                headers=headers,
            )
            if response.status_code in (200, 201, 202):
                logger.info(f"Email sent to {to_email}: {subject}")
                return True
            else:
                logger.error(f"SendGrid error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


async def send_admin_notification(subject: str, body: str) -> bool:
    """Send notification email to admin."""
    if not settings.ADMIN_EMAIL:
        logger.warning("Admin email not configured, skipping notification")
        return False

    return await send_email(
        to_email=settings.ADMIN_EMAIL,
        subject=f"[Processa AI] {subject}",
        body=body,
    )


# Billing-specific email templates


async def send_subscription_welcome(user_email: str, plan_name: str) -> bool:
    """Send welcome email when subscription is activated."""
    subject = "Bem-vindo ao Processa AI!"
    body = f"""Olá!

Sua assinatura do plano {plan_name} foi ativada com sucesso.

Agora você tem acesso a todas as funcionalidades do seu plano.

Acesse o sistema em: {settings.FRONTEND_URL}/app

Se tiver alguma dúvida, entre em contato conosco.

Atenciosamente,
Equipe Processa AI
"""
    return await send_email(to_email=user_email, subject=subject, body=body)


async def send_payment_failed(user_email: str, invoice_url: str | None = None) -> bool:
    """Send email when payment fails."""
    subject = "Problema com seu pagamento - Processa AI"

    invoice_text = ""
    if invoice_url:
        invoice_text = f"\nAtualize seu método de pagamento aqui: {invoice_url}\n"

    body = f"""Olá!

Não conseguimos processar o pagamento da sua assinatura do Processa AI.
{invoice_text}
Por favor, atualize suas informações de pagamento para evitar a suspensão do serviço.

Se precisar de ajuda, entre em contato conosco.

Atenciosamente,
Equipe Processa AI
"""
    return await send_email(to_email=user_email, subject=subject, body=body)


async def send_subscription_canceled(user_email: str) -> bool:
    """Send email when subscription is canceled."""
    subject = "Sua assinatura foi cancelada - Processa AI"
    body = f"""Olá!

Sua assinatura do Processa AI foi cancelada.

Sentiremos sua falta! Se mudar de ideia, você pode reativar sua assinatura a qualquer momento.

Acesse: {settings.FRONTEND_URL}/planos

Atenciosamente,
Equipe Processa AI
"""
    return await send_email(to_email=user_email, subject=subject, body=body)


async def send_payment_action_required(
    user_email: str, invoice_url: str | None = None
) -> bool:
    """Send email when payment requires action (e.g., 3D Secure)."""
    subject = "Ação necessária para completar seu pagamento - Processa AI"

    invoice_text = ""
    if invoice_url:
        invoice_text = f"\nClique aqui para completar o pagamento: {invoice_url}\n"

    body = f"""Olá!

Seu pagamento requer uma ação adicional para ser concluído (como verificação de segurança do cartão).
{invoice_text}
Por favor, complete o processo para manter sua assinatura ativa.

Atenciosamente,
Equipe Processa AI
"""
    return await send_email(to_email=user_email, subject=subject, body=body)


async def send_dispute_alert(
    user_id: str,
    charge_id: str,
    amount: int,
    reason: str,
) -> bool:
    """Send urgent notification to admin about a dispute."""
    subject = "URGENTE: Disputa de cobrança recebida"
    body = f"""ALERTA DE DISPUTA

Uma disputa de cobrança foi aberta:

- User ID: {user_id}
- Charge ID: {charge_id}
- Valor: R$ {amount / 100:.2f}
- Motivo: {reason}

Acesse o dashboard do Stripe para mais detalhes e responder à disputa.

AÇÃO URGENTE NECESSÁRIA!
"""
    return await send_admin_notification(subject, body)
