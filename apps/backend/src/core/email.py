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
    bcc_emails: list[str] | None = None,
) -> bool:
    """
    Send an email using SendGrid.

    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
        from_email: Optional sender email (defaults to SENDGRID_FROM)
        bcc_emails: Optional list of BCC recipients

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

    personalization = {
        "to": [{"email": to_email}],
        "subject": subject,
    }

    # Add BCC recipients if provided
    if bcc_emails:
        personalization["bcc"] = [{"email": email} for email in bcc_emails]

    payload = {
        "personalizations": [personalization],
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


async def send_payment_action_required(user_email: str, invoice_url: str | None = None) -> bool:
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


# Blog notification templates


def _build_unsubscribe_link(url: str | None, token: str | None) -> str:
    """Build unsubscribe HTML link for email footer."""
    if not token or not url:
        return ""
    return f'<p class="unsubscribe"><a href="{url}">Cancelar inscrição</a></p>'


async def send_new_blog_post_notification(
    to_email: str,
    subscriber_name: str | None,
    post_title: str,
    post_excerpt: str | None,
    post_slug: str,
    category_name: str | None = None,
    unsubscribe_token: str | None = None,
) -> bool:
    """Send notification email about a new blog post."""
    subject = f"Novo artigo: {post_title} - Processa AI"

    greeting = f"Olá{', ' + subscriber_name if subscriber_name else ''}!"

    category_text = ""
    if category_name:
        category_text = f"\nCategoria: {category_name}\n"

    excerpt_text = ""
    if post_excerpt:
        excerpt_text = f"\n{post_excerpt}\n"

    post_url = f"{settings.FRONTEND_URL}/blog/{post_slug}"

    unsubscribe_text = ""
    if unsubscribe_token:
        unsubscribe_url = f"{settings.FRONTEND_URL}/blog?unsubscribe={unsubscribe_token}"
        unsubscribe_text = f"\n---\nPara cancelar sua inscrição na newsletter: {unsubscribe_url}"

    body = f"""{greeting}

Publicamos um novo artigo no blog do Processa AI que pode ser do seu interesse:

{post_title}
{category_text}{excerpt_text}
Leia o artigo completo em: {post_url}

Atenciosamente,
Equipe Processa AI
{unsubscribe_text}
"""

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #1a365d; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background-color: #f7fafc; }}
        .post-title {{ font-size: 24px; color: #1a365d; margin-bottom: 10px; }}
        .category {{ color: #718096; font-size: 14px; margin-bottom: 15px; }}
        .excerpt {{ color: #4a5568; margin-bottom: 20px; }}
        .cta-button {{
            display: inline-block; background-color: #3182ce; color: white;
            padding: 12px 24px; text-decoration: none; border-radius: 5px;
        }}
        .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #718096; }}
        .unsubscribe {{ color: #a0aec0; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Processa AI</h1>
        </div>
        <div class="content">
            <p>{greeting}</p>
            <p>Publicamos um novo artigo no blog que pode ser do seu interesse:</p>
            <h2 class="post-title">{post_title}</h2>
            {f'<p class="category">{category_name}</p>' if category_name else ""}
            {f'<p class="excerpt">{post_excerpt}</p>' if post_excerpt else ""}
            <p>
                <a href="{post_url}" class="cta-button">Ler artigo completo</a>
            </p>
        </div>
        <div class="footer">
            <p>Atenciosamente,<br>Equipe Processa AI</p>
            {_build_unsubscribe_link(unsubscribe_url, unsubscribe_token)}
        </div>
    </div>
</body>
</html>
"""

    return await send_email(
        to_email=to_email,
        subject=subject,
        body=body,
        html_body=html_body,
    )


async def send_new_blog_post_notification_bulk(
    subscriber_emails: list[str],
    post_title: str,
    post_excerpt: str | None,
    post_slug: str,
    category_name: str | None = None,
) -> bool:
    """
    Send notification email about a new blog post to multiple subscribers using BCC.
    This sends a single email with all subscribers in BCC to improve performance.

    Args:
        subscriber_emails: List of subscriber email addresses
        post_title: Title of the blog post
        post_excerpt: Optional excerpt of the post
        post_slug: Slug of the post for URL generation
        category_name: Optional category name

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not subscriber_emails:
        logger.info("No subscribers to notify")
        return False

    subject = f"Novo artigo: {post_title} - Processa AI"

    greeting = "Olá!"

    category_text = ""
    if category_name:
        category_text = f"\nCategoria: {category_name}\n"

    excerpt_text = ""
    if post_excerpt:
        excerpt_text = f"\n{post_excerpt}\n"

    post_url = f"{settings.FRONTEND_URL}/blog/{post_slug}"

    body = f"""{greeting}

Publicamos um novo artigo no blog do Processa AI que pode ser do seu interesse:

{post_title}
{category_text}{excerpt_text}
Leia o artigo completo em: {post_url}

Atenciosamente,
Equipe Processa AI
"""

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #1a365d; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background-color: #f7fafc; }}
        .post-title {{ font-size: 24px; color: #1a365d; margin-bottom: 10px; }}
        .category {{ color: #718096; font-size: 14px; margin-bottom: 15px; }}
        .excerpt {{ color: #4a5568; margin-bottom: 20px; }}
        .cta-button {{
            display: inline-block; background-color: #3182ce; color: white;
            padding: 12px 24px; text-decoration: none; border-radius: 5px;
        }}
        .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #718096; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Processa AI</h1>
        </div>
        <div class="content">
            <p>{greeting}</p>
            <p>Publicamos um novo artigo no blog que pode ser do seu interesse:</p>
            <h2 class="post-title">{post_title}</h2>
            {f'<p class="category">{category_name}</p>' if category_name else ""}
            {f'<p class="excerpt">{post_excerpt}</p>' if post_excerpt else ""}
            <p>
                <a href="{post_url}" class="cta-button">Ler artigo completo</a>
            </p>
        </div>
        <div class="footer">
            <p>Atenciosamente,<br>Equipe Processa AI</p>
        </div>
    </div>
</body>
</html>
"""

    # Use sender as TO and all subscribers as BCC
    sender = settings.SENDGRID_FROM or settings.ADMIN_EMAIL

    # Remove sender from subscriber list to avoid duplication
    # (SendGrid requires unique emails between to, cc, and bcc)
    unique_subscribers = [email for email in subscriber_emails if email.lower() != sender.lower()]

    # SendGrid BCC limit is 1000 per request, split if needed
    batch_size = 1000
    total_sent = 0

    for i in range(0, len(unique_subscribers), batch_size):
        batch = unique_subscribers[i : i + batch_size]
        success = await send_email(
            to_email=sender,  # Sender receives the email visibly
            subject=subject,
            body=body,
            html_body=html_body,
            bcc_emails=batch,
        )
        if success:
            total_sent += len(batch)
            logger.info(
                f"Sent blog notification to {len(batch)} subscribers (batch {i // batch_size + 1})"
            )
        else:
            logger.error(f"Failed to send blog notification batch {i // batch_size + 1}")

    return total_sent == len(unique_subscribers)
