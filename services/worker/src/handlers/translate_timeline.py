"""Handler para tradução de andamentos processuais para linguagem simples."""

import json

from src.core.config import settings
from src.core.db import get_pool
from src.core.gemini import generate_text
from src.core.logging import logger

VALID_SENTIMENTS = {"positive", "neutral", "negative", "urgent"}
VALID_PHASES = {"inicio", "defesa", "instrucao", "sentenca", "recurso", "execucao", "encerrado"}

SYSTEM_PROMPT = """Você é um tradutor jurídico especializado em transformar movimentações
processuais em português simples para clientes leigos.

REGRAS:
- Use linguagem clara, sem termos jurídicos
- Seja empático e tranquilizador quando possível
- Nunca dê conselho jurídico — apenas explique o que aconteceu
- Referencie "Seu advogado" (nunca cite o nome)
- Frases curtas, no máximo 2 linhas cada campo
- Se a movimentação indicar algo que o cliente precisa fazer
  (comparecer a audiência, levar documento), destaque claramente

RESPONDA em JSON com exatamente estes campos:
{
  "summary": "O que aconteceu, em uma frase simples",
  "explanation": "O que isso significa para o cliente",
  "action_required": "O que o cliente precisa fazer (ou 'Nenhuma ação necessária')",
  "next_step": "Qual o próximo passo provável do processo (ou null)",
  "sentiment": "positive | neutral | negative | urgent",
  "process_phase": "inicio | defesa | instrucao | sentenca | recurso | execucao | encerrado",
  "process_phase_progress": 0
}"""


def _build_user_prompt(job: dict) -> str:
    return (
        f"Tipo do processo: {job.get('process_type') or 'Não informado'}\n"
        f"Tipo do evento: {job.get('event_type') or 'Não informado'}\n"
        f"Título: {job.get('title') or ''}\n"
        f"Descrição: {job.get('description') or ''}\n\n"
        "Traduza para o cliente."
    )


async def handle_translate_timeline_event(job: dict) -> None:
    """Traduz um andamento processual para português simples e persiste no banco."""
    timeline_event_id = job.get("timeline_event_id")
    if not timeline_event_id:
        logger.warning("translate_timeline_event: timeline_event_id ausente no job")
        return

    user_prompt = _build_user_prompt(job)

    try:
        raw = await generate_text(
            system_instruction=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            model=settings.GEMINI_TRANSLATION_MODEL,
        )
        translation = json.loads(raw)
    except Exception:
        logger.exception("Falha ao traduzir evento %s", timeline_event_id)
        return

    required_fields = ("summary", "explanation", "action_required", "sentiment", "process_phase")
    for field in required_fields:
        if field not in translation:
            logger.error(
                "Tradução inválida para evento %s: campo '%s' ausente. Raw: %s",
                timeline_event_id,
                field,
                raw[:200],
            )
            return

    # Sanitize enum values — fallback to safe defaults if LLM returns unexpected values
    if translation["sentiment"] not in VALID_SENTIMENTS:
        logger.warning(
            "Sentiment inválido '%s' para evento %s, usando 'neutral'",
            translation["sentiment"],
            timeline_event_id,
        )
        translation["sentiment"] = "neutral"

    if translation.get("process_phase") and translation["process_phase"] not in VALID_PHASES:
        logger.warning(
            "Phase inválida '%s' para evento %s, usando None",
            translation["process_phase"],
            timeline_event_id,
        )
        translation["process_phase"] = None
        translation["process_phase_progress"] = None

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO office_api.timeline_translations
                    (timeline_event_id, summary, explanation, action_required,
                     next_step, sentiment, process_phase, process_phase_progress, model)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (timeline_event_id)
                DO UPDATE SET
                    summary = EXCLUDED.summary,
                    explanation = EXCLUDED.explanation,
                    action_required = EXCLUDED.action_required,
                    next_step = EXCLUDED.next_step,
                    sentiment = EXCLUDED.sentiment,
                    process_phase = EXCLUDED.process_phase,
                    process_phase_progress = EXCLUDED.process_phase_progress,
                    model = EXCLUDED.model
                """,
                (
                    timeline_event_id,
                    translation["summary"],
                    translation["explanation"],
                    translation["action_required"],
                    translation.get("next_step"),
                    translation["sentiment"],
                    translation.get("process_phase"),
                    translation.get("process_phase_progress"),
                    settings.GEMINI_TRANSLATION_MODEL,
                ),
            )
        await conn.commit()

    logger.info("Tradução salva para evento %s", timeline_event_id)
