
from psycopg.types.json import Jsonb

from src.core.db import get_pool

_ENQUEUE_SQL = "INSERT INTO job_queue (queue, payload) VALUES (%s, %s)"


async def enqueue_job(payload: dict) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(_ENQUEUE_SQL, ("jobs", Jsonb(payload)))


async def enqueue_translation_job(payload: dict) -> None:
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(_ENQUEUE_SQL, ("translation_queue", Jsonb(payload)))
