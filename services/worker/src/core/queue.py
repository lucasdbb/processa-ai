"""Unified job queue operating directly against public.jobs.

Jobs are claimed via FOR UPDATE SKIP LOCKED on the unified jobs table.
No separate job_queue table is needed — a job row in status='queued' IS
the queue entry.

Stuck-job reaping operates on jobs with status='processing' and stale
claimed_at timestamps.
"""

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger

# How long a job can stay in "processing" before being considered stuck (seconds)
VISIBILITY_TIMEOUT_S = 900  # 15 minutes

MAX_RETRIES = 3

# ---------------------------------------------------------------------------
# Dequeue: atomically claim the next queued job
# ---------------------------------------------------------------------------

_DEQUEUE_SQL = """
UPDATE public.jobs
SET    status     = 'processing',
       claimed_at = NOW()
WHERE  id = (
    SELECT id FROM public.jobs
    WHERE  queue = %s
      AND  status = 'queued'
    ORDER  BY priority DESC, created_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, job_type, user_id, client_id, request_payload;
"""


async def _dequeue(queue: str) -> dict | None:
    """Claim the next queued job from the given queue.

    Returns a dict with {id, job_type, user_id, client_id, request_payload}
    or None if no jobs available.
    """
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(_DEQUEUE_SQL, (queue,))
            row = await cur.fetchone()
    return row


async def dequeue_job() -> dict | None:
    """Claim the next AI/calculator job from the 'jobs' queue."""
    return await _dequeue("jobs")


async def dequeue_translation_job() -> dict | None:
    """Claim the next translation job from the 'translation_queue' queue."""
    return await _dequeue("translation_queue")


# ---------------------------------------------------------------------------
# Nack: return a failed job to the queue for retry
# ---------------------------------------------------------------------------


async def nack_job(job_id) -> None:
    """Return a job to 'queued' state for retry, incrementing retries."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "UPDATE public.jobs "
                "SET status = 'queued', claimed_at = NULL, retries = retries + 1 "
                "WHERE id = %s",
                (job_id,),
            )


# ---------------------------------------------------------------------------
# Reaper: re-enqueue stuck jobs or move to dead letter
# ---------------------------------------------------------------------------

_REAP_SQL = """
UPDATE public.jobs
SET    status     = 'queued',
       claimed_at = NULL,
       retries    = retries + 1
WHERE  status     = 'processing'
  AND  claimed_at < NOW() - INTERVAL '%s seconds'
RETURNING id, queue, retries;
"""

_DEAD_LETTER_SQL = """
UPDATE public.jobs
SET    status = 'dead', finished_at = NOW()
WHERE  id = %s;
"""


async def reap_stuck_jobs() -> int:
    """Re-enqueue jobs stuck in 'processing' beyond the visibility timeout.

    Jobs that exceed MAX_RETRIES are moved to 'dead' status.
    Returns the number of jobs re-enqueued.
    """
    pool = await get_pool()
    reaped = 0
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(_REAP_SQL, (VISIBILITY_TIMEOUT_S,))
            rows = await cur.fetchall()

            for row in rows:
                job_id, queue, retries = row[0], row[1], row[2]
                if retries >= MAX_RETRIES:
                    await cur.execute(_DEAD_LETTER_SQL, (job_id,))
                    logger.warning(
                        "Job %s in queue '%s' exceeded max retries (%d), moved to dead letter",
                        job_id,
                        queue,
                        MAX_RETRIES,
                    )
                else:
                    reaped += 1
                    logger.info(
                        "Re-enqueued stuck job %s in queue '%s' (retry %d/%d)",
                        job_id,
                        queue,
                        retries,
                        MAX_RETRIES,
                    )
    return reaped
