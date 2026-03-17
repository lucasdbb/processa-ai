from src.core.db import get_pool

_DEQUEUE_SQL = """
DELETE FROM job_queue
WHERE id = (
    SELECT id FROM job_queue
    WHERE queue = %s
    ORDER BY id
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING payload;
"""


async def _dequeue(queue: str) -> dict | None:
    pool = await get_pool()
    async with pool.connection() as conn:
        row = await (await conn.execute(_DEQUEUE_SQL, (queue,))).fetchone()
    return row[0] if row else None


async def dequeue_job() -> dict | None:
    return await _dequeue("jobs")


async def dequeue_translation_job() -> dict | None:
    return await _dequeue("translation_queue")
