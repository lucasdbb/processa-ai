"""
Script para envio do e-mail de encerramento das atividades do Processa AI.

Uso:
    # Teste — envia apenas para o e-mail informado
    uv run python scripts/send_shutdown_email.py teste@exemplo.com

    # Produção — envia para todos os usuários cadastrados (auth.users)
    uv run python scripts/send_shutdown_email.py
"""

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.config import settings
from src.core.email import load_email_template, send_email
from src.core.supabase import get_supabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


SUBJECT = "Encerramento das atividades do Processa AI"

CONTENT_HTML = (
    "Olá!<br><br>"
    "É com pesar que comunicamos o <strong>encerramento das atividades do Processa AI</strong>."
    "<br><br>"
    "Agradecemos imensamente pela confiança depositada em nossa plataforma ao longo dessa jornada."
    "<br><br>"
    "<strong>Exportação dos seus dados</strong><br>"
    "Antes do encerramento, recomendamos fortemente que você acesse a área de "
    "<strong>Configurações</strong> da plataforma e exporte todos os seus dados "
    "(clientes, processos, documentos, prazos, honorários e demais informações). "
    "Após o encerramento, <strong>todos os dados serão permanentemente deletados</strong>, "
    "sem possibilidade de recuperação."
    "<br><br>"
    "<strong>Reembolso de assinaturas ativas</strong><br>"
    "Para os assinantes com planos ativos, o valor proporcional ao período não utilizado "
    "(<em>pro-rata</em>) será devidamente reembolsado, sem necessidade de qualquer ação "
    "da sua parte."
    "<br><br>"
    "Em caso de dúvidas, entre em contato pelos nossos canais de suporte.<br><br>"
    "Mais uma vez, muito obrigado pela parceria."
)

CONTENT_TEXT = (
    "Olá!\n\n"
    "É com pesar que comunicamos o encerramento das atividades do Processa AI.\n\n"
    "Agradecemos imensamente pela confiança depositada em nossa plataforma ao longo "
    "dessa jornada.\n\n"
    "EXPORTAÇÃO DOS SEUS DADOS\n"
    "Antes do encerramento, recomendamos fortemente que você acesse a área de "
    "Configurações da plataforma e exporte todos os seus dados (clientes, processos, "
    "documentos, prazos, honorários e demais informações). Após o encerramento, todos "
    "os dados serão permanentemente deletados, sem possibilidade de recuperação.\n\n"
    f"Para exportar, acesse: {settings.FRONTEND_URL}/app/configuracoes\n\n"
    "REEMBOLSO DE ASSINATURAS ATIVAS\n"
    "Para os assinantes com planos ativos, o valor proporcional ao período não utilizado "
    "(pro-rata) será devidamente reembolsado, sem necessidade de qualquer ação da sua parte.\n\n"
    "Em caso de dúvidas, entre em contato pelos nossos canais de suporte.\n\n"
    "Mais uma vez, muito obrigado pela parceria.\n\n"
    "Atenciosamente,\nEquipe Processa AI"
)


def build_html_body() -> str:
    return load_email_template(
        "default.html",
        {
            "Titulo": "Encerramento das atividades",
            "Conteudo": CONTENT_HTML,
            "Botao_Texto": "Exportar meus dados",
            "Botao_Link": "https://www.processai.app.br/app/configuracoes",
        },
    )


async def send_to_one(email: str, html_body: str) -> bool:
    logger.info(f"Enviando para {email}...")
    ok = await send_email(
        to_email=email,
        subject=SUBJECT,
        body=CONTENT_TEXT,
        html_body=html_body,
    )
    if ok:
        logger.info(f"  OK -> {email}")
    else:
        logger.error(f"  FALHA -> {email}")
    return ok


def fetch_all_user_emails() -> list[str]:
    """Busca todos os e-mails dos usuários via Supabase Admin API (paginado)."""
    supabase = get_supabase()
    emails: list[str] = []
    page = 1
    per_page = 1000

    while True:
        try:
            response = supabase.auth.admin.list_users(page=page, per_page=per_page)
        except TypeError:
            response = supabase.auth.admin.list_users({"page": page, "per_page": per_page})

        users = response if isinstance(response, list) else getattr(response, "users", []) or []
        if not users:
            break

        for user in users:
            email = getattr(user, "email", None) or (
                user.get("email") if isinstance(user, dict) else None
            )
            if email:
                emails.append(email.strip().lower())

        if len(users) < per_page:
            break
        page += 1

    unique = sorted(set(emails))
    logger.info(f"Total de usuários únicos com e-mail: {len(unique)}")
    return unique


async def send_bulk(emails: list[str], html_body: str) -> None:
    """Envia em lotes via BCC (mesmo padrão de send_new_blog_post_notification_bulk)."""
    if not emails:
        logger.warning("Nenhum destinatário encontrado.")
        return

    sender = (settings.BREVO_FROM or "").strip()
    if not sender:
        logger.error("BREVO_FROM não configurado.")
        return

    recipients = [e for e in emails if e.lower() != sender.lower()]
    batch_size = 1000
    total_batches = (len(recipients) + batch_size - 1) // batch_size

    logger.info(
        f"Disparando {len(recipients)} e-mails em {total_batches} lote(s) de até {batch_size}..."
    )

    failures = 0
    for i in range(0, len(recipients), batch_size):
        batch = recipients[i : i + batch_size]
        ok = await send_email(
            to_email=sender,
            subject=SUBJECT,
            body=CONTENT_TEXT,
            html_body=html_body,
            bcc_emails=batch,
        )
        if ok:
            logger.info(f"  Lote {i // batch_size + 1}/{total_batches} enviado ({len(batch)} BCC).")
        else:
            failures += 1
            logger.error(f"  Lote {i // batch_size + 1}/{total_batches} FALHOU.")

    if failures:
        logger.error(f"Concluído com {failures} lote(s) com falha.")
    else:
        logger.info("Disparo concluído com sucesso.")


async def main() -> int:
    target_email = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1].strip() else None

    if not (settings.BREVO_API_KEY or "").strip():
        logger.error("BREVO_API_KEY não configurado. Abortando.")
        return 1

    html_body = build_html_body()
    if not html_body:
        logger.error("Falha ao renderizar template default.html.")
        return 1

    logger.info("=" * 60)
    if target_email:
        logger.info(f"MODO TESTE: enviando apenas para {target_email}")
        logger.info("=" * 60)
        ok = await send_to_one(target_email, html_body)
        return 0 if ok else 1

    logger.info("MODO PRODUÇÃO: disparo para TODOS os usuários cadastrados")
    logger.info("=" * 60)

    confirm = input("Tem certeza? Digite 'CONFIRMAR' para prosseguir: ").strip()
    if confirm != "CONFIRMAR":
        logger.info("Cancelado pelo usuário.")
        return 0

    emails = fetch_all_user_emails()
    await send_bulk(emails, html_body)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
