"""Translation service — enqueues and fetches timeline translations."""

import json

from psycopg.rows import dict_row

from src.core.logging import logger
from src.core.queue import enqueue_translation_job
from src.features.portal.translation.schemas import TimelineTranslation


class TranslationService:

    async def enqueue_translation(self, conn, timeline_event_id: str) -> bool:
        """
        Verifica se o processo do evento tem cliente vinculado.
        Se sim, enfileira job de tradução.
        Retorna True se enfileirado, False caso contrário.
        """
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT te.id, te.event_type, te.title, te.description,
                       p.type AS process_type, p.process_number, p.client_id
                FROM office_api.timeline_events te
                JOIN office_api.processes p ON p.id = te.process_id
                WHERE te.id = %s
                """,
                (timeline_event_id,),
            )
            row = await cur.fetchone()

        if not row or not row["client_id"]:
            return False

        payload = {
            "job_type": "translate_timeline_event",
            "timeline_event_id": str(row["id"]),
            "event_type": row["event_type"],
            "title": row["title"],
            "description": row["description"],
            "process_type": row["process_type"],
            "process_number": row["process_number"],
        }

        try:
            await enqueue_translation_job(payload)
        except Exception:
            logger.exception("Failed to enqueue translation job for event %s", timeline_event_id)
            return False

        return True

    async def get_translations_for_events(
        self, conn, event_ids: list[str]
    ) -> dict[str, TimelineTranslation]:
        """
        Busca traduções para uma lista de timeline_event_ids.
        Retorna dict: {event_id: TimelineTranslation}
        """
        if not event_ids:
            return {}

        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT id, timeline_event_id, summary, explanation, action_required,
                       next_step, sentiment, process_phase, process_phase_progress, model
                FROM office_api.timeline_translations
                WHERE timeline_event_id = ANY(%s)
                """,
                (event_ids,),
            )
            rows = await cur.fetchall()

        return {
            str(r["timeline_event_id"]): TimelineTranslation(
                id=str(r["id"]),
                timeline_event_id=str(r["timeline_event_id"]),
                summary=r["summary"],
                explanation=r["explanation"],
                action_required=r["action_required"],
                next_step=r["next_step"],
                sentiment=r["sentiment"],
                process_phase=r["process_phase"],
                process_phase_progress=r["process_phase_progress"],
                model=r["model"],
            )
            for r in rows
        }


translation_service = TranslationService()
