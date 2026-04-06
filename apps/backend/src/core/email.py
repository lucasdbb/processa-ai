"""
Email service using Brevo.
"""

from datetime import datetime
from pathlib import Path

import httpx

from src.core.config import settings
from src.core.logging import logger

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _resolve_email_api_key() -> str:
    """Resolve Brevo API key."""
    return (settings.BREVO_API_KEY or "").strip()


def _resolve_sender_email(from_email: str | None = None) -> str:
    """Resolve sender email preferring explicit sender, then default Brevo sender."""
    if from_email and from_email.strip():
        return from_email.strip()
    return (settings.BREVO_FROM or "").strip()


def _get_pt_day_name() -> str:
    """Get the current day of the week in Portuguese."""
    days = {
        0: "Segunda-feira",
        1: "Terça-feira",
        2: "Quarta-feira",
        3: "Quinta-feira",
        4: "Sexta-feira",
        5: "Sábado",
        6: "Domingo",
    }
    return days[datetime.now().weekday()]


def load_email_template(template_name: str, context: dict) -> str:
    """
    Load an HTML email template and render it with Jinja2.

    Supports template inheritance ({% extends %}), blocks, and conditionals.

    Args:
        template_name: Name of the template file (e.g. 'default.html')
        context: Dictionary of values to replace placeholders

    Returns:
        The rendered HTML string
    """
    try:
        from jinja2 import Environment, FileSystemLoader

        base_dir = Path(__file__).parent.parent.parent
        templates_dir = base_dir / "src" / "templates" / "emails"

        if not (templates_dir / template_name).exists():
            logger.warning(f"Template {template_name} not found")
            return ""

        # Pre-process button HTML from Botao_Texto + Botao_Link
        cta_text = context.get("Botao_Texto")
        cta_link = context.get("Botao_Link")

        button_html = ""
        if cta_text and cta_link:
            button_html = (
                f'<a href="{cta_link}" class="btn" '
                f'style="display:inline-block;background-color:#0f3366;color:#ffffff !important;'
                f"padding:12px 28px;border-radius:6px;font-weight:600;font-size:14px;"
                f'text-decoration:none;margin-top:10px;">{cta_text}</a>'
            )

        context = {
            "EMAIL_LOGO_URL": settings.EMAIL_LOGO_URL
            or "https://www.processai.app.br/logo_light.png",
            **context,
            "Botao_HTML": button_html,
        }

        env = Environment(
            loader=FileSystemLoader(str(templates_dir)),
            autoescape=False,
        )
        template = env.get_template(template_name)
        return template.render(**context)
    except Exception as e:
        logger.error(f"Error loading email template {template_name}: {e}")
        return ""


async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
    from_email: str | None = None,
    bcc_emails: list[str] | None = None,
) -> bool:
    """
    Send an email using Brevo.

    Args:
        to_email: Recipient email address
        subject: Email subject
        body: Plain text body
        html_body: Optional HTML body
        from_email: Optional sender email (defaults to BREVO_FROM)
        bcc_emails: Optional list of BCC recipients

    Returns:
        True if email was sent successfully, False otherwise
    """
    api_key = _resolve_email_api_key()
    if not api_key:
        logger.warning("Brevo API key not configured, skipping email")
        return False

    sender = _resolve_sender_email(from_email)
    if not sender:
        logger.warning("No sender email configured, skipping email")
        return False
    sender_name = (settings.BREVO_FROM_NAME or "Contato - Processa AI").strip()

    payload: dict[str, object] = {
        "sender": {"email": sender, "name": sender_name},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": body,
    }

    if html_body:
        payload["htmlContent"] = html_body

    if bcc_emails:
        bcc_list = []
        for email in bcc_emails:
            if not isinstance(email, str):
                continue
            normalized = email.strip()
            if not normalized:
                continue
            if normalized.lower() == to_email.lower():
                continue
            bcc_list.append({"email": normalized})
        if bcc_list:
            payload["bcc"] = bcc_list

    headers = {
        "api-key": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                BREVO_API_URL,
                json=payload,
                headers=headers,
            )
            if 200 <= response.status_code < 300:
                logger.info(f"Email sent to {to_email}: {subject}")
                return True
            else:
                logger.error(f"Brevo error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


# Deadline email helpers


def _format_deadline_urgency(days_until: int) -> str:
    """Format urgency text for a deadline based on days remaining."""
    if days_until == 0:
        return "HOJE"
    elif days_until == 1:
        return "amanhã"
    else:
        return f"em {days_until} dias"


def _build_deadlines_text_list(deadlines: list[dict]) -> str:
    """Build a plain-text list of deadlines for email body."""
    lines = []
    for d in deadlines:
        urgency = _format_deadline_urgency(d["days_until"])
        lines.append(f"  • {d['title']} — vence {urgency} ({d['due_date_str']})")
    return "\n".join(lines)


def _build_deadlines_html_list(deadlines: list[dict]) -> str:
    """Build an HTML list of deadlines for email body."""
    items = []
    for d in deadlines:
        urgency = _format_deadline_urgency(d["days_until"])
        color = (
            "#dc2626" if d["days_until"] <= 1 else "#d97706" if d["days_until"] <= 3 else "#334155"
        )
        items.append(
            f'<li style="margin-bottom: 8px;">'
            f"<strong>{d['title']}</strong> — "
            f'<span style="color: {color}; font-weight: 600;">vence {urgency}</span> '
            f"({d['due_date_str']})</li>"
        )
    return f'<ul style="padding-left: 20px; margin: 16px 0;">{"".join(items)}</ul>'


async def send_deadline_reminder(
    to_email: str,
    user_name: str | None,
    deadlines: list[dict],
) -> bool:
    """
    Send a single consolidated email with all upcoming deadline reminders for a user.

    Each item in deadlines should have: title, days_until, due_date_str.
    """
    count = len(deadlines)
    if count == 0:
        return False

    deadlines = sorted(deadlines, key=lambda d: d["days_until"])

    most_urgent = deadlines[0]["days_until"]
    if count == 1:
        urgency = _format_deadline_urgency(most_urgent)
        subject = f"Lembrete de prazo: {deadlines[0]['title']} (vence {urgency})"
    else:
        if most_urgent == 0:
            subject = f"Atenção: {count} prazos se aproximam (1 vence HOJE)"
        elif most_urgent == 1:
            subject = f"Atenção: {count} prazos se aproximam (1 vence amanhã)"
        else:
            subject = f"Lembrete: {count} prazos se aproximam"

    greeting = f"Olá{', ' + user_name if user_name else ''}!"
    deadlines_text = _build_deadlines_text_list(deadlines)
    deadlines_html = _build_deadlines_html_list(deadlines)

    content_text = f"{greeting}\n\nVocê tem {count} prazo(s) se aproximando:\n\n{deadlines_text}"
    cta_link = f"{settings.FRONTEND_URL}/app/calendario"

    body = f"{content_text}\n\nAcesse seu calendário: {cta_link}\n\nAtenciosamente,\nEquipe Processa AI"

    content_html = (
        f"{greeting}<br><br>"
        f"Você tem <strong>{count} prazo(s)</strong> se aproximando:"
        f"{deadlines_html}"
    )

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": f"{count} prazo(s) se aproximando",
            "Conteudo": content_html,
            "Botao_Texto": "Ver Calendário",
            "Botao_Link": cta_link,
            "Rodape": "Você recebeu este e-mail porque possui prazos cadastrados no Processa AI.",
        },
    )

    return await send_email(to_email=to_email, subject=subject, body=body, html_body=html_body)


async def send_weekly_deadline_summary(
    to_email: str,
    user_name: str | None,
    deadlines: list[dict],
) -> bool:
    """
    Send a weekly summary of all pending deadlines for the next 7 days.

    Each item in deadlines should have: title, days_until, due_date_str.
    """
    count = len(deadlines)
    if count == 0:
        return False

    deadlines = sorted(deadlines, key=lambda d: d["days_until"])

    subject = f"Resumo semanal: {count} prazo(s) nos próximos 7 dias"

    greeting = f"Olá{', ' + user_name if user_name else ''}!"
    deadlines_text = _build_deadlines_text_list(deadlines)
    deadlines_html = _build_deadlines_html_list(deadlines)

    content_text = f"{greeting}\n\nAqui está o resumo dos seus prazos para a próxima semana:\n\n{deadlines_text}"
    cta_link = f"{settings.FRONTEND_URL}/app/calendario"

    body = f"{content_text}\n\nAcesse seu calendário: {cta_link}\n\nAtenciosamente,\nEquipe Processa AI"

    content_html = (
        f"{greeting}<br><br>"
        f"Aqui está o resumo dos seus prazos para a próxima semana:"
        f"{deadlines_html}"
    )

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "Resumo Semanal de Prazos",
            "Conteudo": content_html,
            "Botao_Texto": "Ver Calendário",
            "Botao_Link": cta_link,
            "Rodape": "Você recebe este resumo toda segunda-feira.",
        },
    )

    return await send_email(to_email=to_email, subject=subject, body=body, html_body=html_body)


# Billing-specific email templates


async def send_subscription_welcome(user_email: str, plan_name: str) -> bool:
    """Send welcome email when subscription is activated."""
    subject = "Bem-vindo ao Processa AI!"

    content = f"""Olá!

Sua assinatura do plano {plan_name} foi ativada com sucesso.

Agora você tem acesso a todas as funcionalidades do seu plano.

Se tiver alguma dúvida, entre em contato conosco."""

    body = (
        f"{content}\n\nAcesse o sistema em: {settings.FRONTEND_URL}/app\n"
        "\nAtenciosamente,\nEquipe Processa AI"
    )

    # Load HTML template
    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "Bem-vindo ao Processa AI!",
            "Segundo_Titulo": "Sua assinatura está ativa",
            "Conteudo": content.replace("\n", "<br>"),
            "Botao_Texto": "Acessar Sistema",
            "Botao_Link": f"{settings.FRONTEND_URL}/app",
            "Rodape": "Este é um email automático, por favor não responda.",
        },
    )

    return await send_email(to_email=user_email, subject=subject, body=body, html_body=html_body)


async def send_payment_failed(user_email: str, invoice_url: str | None = None) -> bool:
    """Send email when payment fails."""
    subject = "Problema com seu pagamento - Processa AI"

    invoice_text = ""
    cta_link = ""
    cta_text = ""

    if invoice_url:
        invoice_text = f"\nAtualize seu método de pagamento aqui: {invoice_url}\n"
        cta_link = invoice_url
        cta_text = "Atualizar Pagamento"

    content = """Olá!

Não conseguimos processar o pagamento da sua assinatura do Processa AI.

Por favor, atualize suas informações de pagamento para evitar a suspensão do serviço.

Se precisar de ajuda, entre em contato conosco."""

    body = f"{content}\n{invoice_text}\nAtenciosamente,\nEquipe Processa AI"

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "Falha no Pagamento",
            "Segundo_Titulo": "Ação Necessária",
            "Conteudo": content.replace("\n", "<br>"),
            "Botao_Texto": cta_text,
            "Botao_Link": cta_link,
            "Rodape": "Evite a suspensão dos seus serviços atualizando seu pagamento.",
        },
    )

    return await send_email(to_email=user_email, subject=subject, body=body, html_body=html_body)


async def send_subscription_canceled(user_email: str) -> bool:
    """Send email when subscription is canceled."""
    subject = "Sua assinatura foi cancelada - Processa AI"

    content = """Olá!

Sua assinatura do Processa AI foi cancelada.

Sentiremos sua falta! Se mudar de ideia, você pode reativar sua assinatura a qualquer momento."""

    body = (
        f"{content}\n\nAcesse: {settings.FRONTEND_URL}/planos\n"
        "\nAtenciosamente,\nEquipe Processa AI"
    )

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "Assinatura Cancelada",
            "Segundo_Titulo": "Até logo!",
            "Conteudo": content.replace("\n", "<br>"),
            "Botao_Texto": "Ver Planos",
            "Botao_Link": f"{settings.FRONTEND_URL}/planos",
            "Rodape": "Esperamos vê-lo novamente em breve.",
        },
    )

    return await send_email(to_email=user_email, subject=subject, body=body, html_body=html_body)


async def send_payment_action_required(user_email: str, invoice_url: str | None = None) -> bool:
    """Send email when payment requires action (e.g., 3D Secure)."""
    subject = "Ação necessária para completar seu pagamento - Processa AI"

    invoice_text = ""
    cta_link = ""
    cta_text = ""

    if invoice_url:
        invoice_text = f"\nClique aqui para completar o pagamento: {invoice_url}\n"
        cta_link = invoice_url
        cta_text = "Completar Pagamento"

    content = (
        "Olá!\n\n"
        "Seu pagamento requer uma ação adicional para ser concluído "
        "(como verificação de segurança do cartão).\n\n"
        "Por favor, complete o processo para manter sua assinatura ativa."
    )

    body = f"{content}\n{invoice_text}\nAtenciosamente,\nEquipe Processa AI"

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "Pagamento Pendente",
            "Segundo_Titulo": "Verificação Necessária",
            "Conteudo": content.replace("\n", "<br>"),
            "Botao_Texto": cta_text,
            "Botao_Link": cta_link,
            "Rodape": "Seu pagamento só será processado após esta confirmação.",
        },
    )

    return await send_email(to_email=user_email, subject=subject, body=body, html_body=html_body)


async def send_dispute_alert(
    user_id: str,
    charge_id: str,
    amount: int,
    reason: str,
) -> bool:
    """Send urgent notification to admin about a dispute."""
    subject = "URGENTE: Disputa de cobrança recebida"

    content = f"""Uma disputa de cobrança foi aberta:

- User ID: {user_id}
- Charge ID: {charge_id}
- Valor: R$ {amount / 100:.2f}
- Motivo: {reason}

Acesse o dashboard do Stripe para mais detalhes e responder à disputa."""

    body = f"ALERTA DE DISPUTA\n\n{content}\n\nAÇÃO URGENTE NECESSÁRIA!"

    html_body = load_email_template(
        "default.html",
        {
            "Titulo": "ALERTA DE DISPUTA",
            "Segundo_Titulo": "Ação Urgente Necessária",
            "Conteudo": content.replace("\n", "<br>"),
            "Botao_Texto": "Dashboard Stripe",
            "Botao_Link": "https://dashboard.stripe.com/disputes",
            "Rodape": "Mensagem automática do sistema de billing.",
        },
    )

    # Using send_email directly as send_admin_notification might not be imported
    # or available here contextually.
    # Assuming the original code used send_admin_notification
    # which might be an alias or separate function.
    # The original code snippet showed:
    # `return await send_admin_notification(subject, body)`
    # Mas não vejo definição de send_admin_notification no trecho.
    # I will assume I should use send_email to the admin email.

    admin_email = settings.ADMIN_EMAIL or _resolve_sender_email()
    return await send_email(to_email=admin_email, subject=subject, body=body, html_body=html_body)


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
    post_cover_image_url: str | None = None,
    category_name: str | None = None,
    unsubscribe_token: str | None = None,
) -> bool:
    """Send notification email about a new blog post."""
    subject = f"Novo artigo: {post_title} - Processa AI"

    greeting = f"Olá{', ' + subscriber_name if subscriber_name else ''}!"

    post_url = f"{settings.FRONTEND_URL}/blog/{post_slug}"

    unsubscribe_text = ""
    unsubscribe_url = ""
    if unsubscribe_token:
        unsubscribe_url = f"{settings.FRONTEND_URL}/blog?unsubscribe={unsubscribe_token}"
        unsubscribe_text = f"\n---\nPara cancelar sua inscrição na newsletter: {unsubscribe_url}"

    body = f"""{greeting}

Publicamos um novo artigo no blog do Processa AI que pode ser do seu interesse:

{post_title}
{post_excerpt or ""}

Leia o artigo completo em: {post_url}

Atenciosamente,
Equipe Processa AI
{unsubscribe_text}
"""

    html_body = load_email_template(
        "newsletter.html",
        {
            "USERNAME": subscriber_name or "Leitor",
            "DIA_DA_SEMANA": _get_pt_day_name(),
            "TITULO_POST": post_title,
            "URL_IMAGEM_POST": post_cover_image_url
            or "https://placehold.co/600x200?text=Processa+AI",
            "RESUMO_POST": post_excerpt or "Confira nosso novo artigo no blog!",
            "Url_Post": post_url,
            "unsubscribe": unsubscribe_url,
        },
    )

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
    post_cover_image_url: str | None = None,
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
        post_cover_image_url: Optional URL of the post cover image
        category_name: Optional category name

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not subscriber_emails:
        logger.info("No subscribers to notify")
        return False

    subject = f"Novo artigo: {post_title} - Processa AI"

    post_url = f"{settings.FRONTEND_URL}/blog/{post_slug}"
    # Generic unsubscribe link since we can't personalize for bulk BCC
    unsubscribe_url = f"{settings.FRONTEND_URL}/blog?action=unsubscribe"

    body = f"""Olá!

Publicamos um novo artigo no blog do Processa AI que pode ser do seu interesse:

{post_title}
{post_excerpt or ""}

Leia o artigo completo em: {post_url}

Atenciosamente,
Equipe Processa AI
"""

    html_body = load_email_template(
        "newsletter.html",
        {
            "USERNAME": "Leitor",
            "DIA_DA_SEMANA": _get_pt_day_name(),
            "TITULO_POST": post_title,
            "URL_IMAGEM_POST": post_cover_image_url
            or "https://placehold.co/600x200?text=Processa+AI",
            "RESUMO_POST": post_excerpt or "Confira nosso novo artigo no blog!",
            "Url_Post": post_url,
            "unsubscribe": unsubscribe_url,
        },
    )

    # Use sender as TO and all subscribers as BCC
    sender = _resolve_sender_email()
    if not sender:
        logger.error("No sender email configured")
        return False

    # Remove sender from subscriber list to avoid duplication in recipients.
    unique_subscribers = [email for email in subscriber_emails if email.lower() != sender.lower()]

    # Brevo supports batching recipients; keep chunking conservative.
    batch_size = 1000
    all_success = True

    for i in range(0, len(unique_subscribers), batch_size):
        batch = unique_subscribers[i : i + batch_size]
        success = await send_email(
            to_email=sender,  # Sender receives the email visibly
            subject=subject,
            body=body,
            html_body=html_body,
            bcc_emails=batch,
        )
        if not success:
            all_success = False
            logger.error(f"Failed to send blog notification batch {i // batch_size + 1}")

    return all_success
