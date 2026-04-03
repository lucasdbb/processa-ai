"""Enqueue helpers for the unified jobs table.

Regular jobs are created directly via job_store.create_job() — no separate
queue table is needed anymore.  This module only keeps the translation
helper which creates a fire-and-forget system job.
"""

from psycopg.types.json import Jsonb

from src.core.db import get_pool


async def enqueue_translation_job(payload: dict) -> None:
    """Create a system job in the unified jobs table for timeline translation.

    These jobs have no user_id (system-triggered) and use the
    'translation_queue' queue so the worker's translation loop picks them up.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "INSERT INTO public.jobs (job_type, queue, priority, user_id, request_payload) "
            "VALUES (%s, %s, %s, NULL, %s)",
            (
                payload.get("job_type", "translate_timeline_event"),
                "translation_queue",
                1,
                Jsonb(payload),
            ),
        )
