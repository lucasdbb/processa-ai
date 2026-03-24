"""Job queue with visibility timeout for reliable processing.

Jobs are claimed (not deleted) during processing. If a worker crashes,
a reaper coroutine re-enqueues stuck jobs after VISIBILITY_TIMEOUT_S.
"""

from datetime import datetime, timezone

from src.core.db import get_pool
from src.core.logging import logger

# How long a job can stay in "processing" before being considered stuck (seconds)
VISIBILITY_TIMEOUT_S = 900  # 15 minutes

# --- Claim: atomically mark a job as processing instead of deleting it ---

_CLAIM_SQL = """
UPDATE job_queue
SET    status      = 'processing',
       claimed_at  = NOW()
WHERE  id = (
    SELECT id FROM job_queue
    WHERE  queue = %s
      AND  status = 'pending'
    ORDER  BY id
    LIMIT  1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, payload;
"""

# --- Acknowledge: delete the job after successful processing ---

_ACK_SQL = """
DELETE FROM job_queue WHERE id = %s;
"""

# --- Reaper: re-enqueue jobs stuck in 'processing' beyond visibility timeout ---

_REAP_SQL = """
UPDATE job_queue
SET    status     = 'pending',
       claimed_at = NULL,
       retries    = COALESCE(retries, 0) + 1
WHERE  status     = 'processing'
  AND  claimed_at < NOW() - INTERVAL '%s seconds'
RETURNING id, queue, retries;
"""

# --- Max retries before moving to dead letter ---

MAX_RETRIES = 3

_DEAD_LETTER_SQL = """
UPDATE job_queue
SET    status = 'dead'
WHERE  id = %s;
"""


async def _claim(queue: str) -> tuple[int | None, dict | None]:
    """Claim the next pending job from the given queue.

    Returns (job_queue_id, payload) or (None, None) if no jobs available.
    The job_queue_id must be passed to ack_job() after successful processing.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        row = await (await conn.execute(_CLAIM_SQL, (queue,))).fetchone()
    if row:
        return row[0], row[1]
    return None, None


async def ack_job(job_queue_id: int) -> None:
    """Acknowledge (delete) a job after successful processing."""
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(_ACK_SQL, (job_queue_id,))


async def nack_job(job_queue_id: int) -> None:
    """Return a job to pending state after a processing failure (for retry)."""
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            """
            UPDATE job_queue
            SET    status     = 'pending',
                   claimed_at = NULL,
                   retries    = COALESCE(retries, 0) + 1
            WHERE  id = %s
            """,
            (job_queue_id,),
        )


async def reap_stuck_jobs() -> int:
    """Re-enqueue jobs stuck in 'processing' beyond the visibility timeout.

    Jobs that exceed MAX_RETRIES are moved to 'dead' status.
    Returns the number of jobs re-enqueued.
    """
    pool = await get_pool()
    reaped = 0
    async with pool.connection() as conn:
        rows = await (
            await conn.execute(_REAP_SQL, (VISIBILITY_TIMEOUT_S,))
        ).fetchall()

        for row in rows:
            job_queue_id, queue, retries = row[0], row[1], row[2]
            if retries >= MAX_RETRIES:
                await conn.execute(_DEAD_LETTER_SQL, (job_queue_id,))
                logger.warning(
                    "Job %s in queue '%s' exceeded max retries (%d), moved to dead letter",
                    job_queue_id,
                    queue,
                    MAX_RETRIES,
                )
            else:
                reaped += 1
                logger.info(
                    "Re-enqueued stuck job %s in queue '%s' (retry %d/%d)",
                    job_queue_id,
                    queue,
                    retries,
                    MAX_RETRIES,
                )
    return reaped


async def dequeue_job() -> tuple[int | None, dict | None]:
    """Claim the next AI/calculator job. Returns (job_queue_id, payload)."""
    return await _claim("jobs")


async def dequeue_translation_job() -> tuple[int | None, dict | None]:
    """Claim the next translation job. Returns (job_queue_id, payload)."""
    return await _claim("translation_queue")
