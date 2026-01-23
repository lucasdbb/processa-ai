import json

import redis.asyncio as redis

from src.core.config import settings

_redis_client: redis.Redis | None = None


def _job_key(job_id: str) -> str:
    return f"job:{job_id}"


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def enqueue_job(payload: dict) -> None:
    r = await get_redis()
    await r.rpush(settings.JOBS_QUEUE_KEY, json.dumps(payload, ensure_ascii=False))


async def dequeue_job(*, timeout_s: int = 5) -> dict | None:
    r = await get_redis()
    res = await r.blpop(settings.JOBS_QUEUE_KEY, timeout=timeout_s)
    if not res:
        return None

    _queue, raw = res
    try:
        data = json.loads(raw)
    except Exception:
        return None
    return data if isinstance(data, dict) else None


async def set_job_status(job_id: str, status: dict) -> None:
    r = await get_redis()
    await r.set(
        _job_key(job_id),
        json.dumps(status, ensure_ascii=False),
        ex=int(settings.JOB_STATUS_TTL_S),
    )


async def get_job_status(job_id: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(_job_key(job_id))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except Exception:
        return None
    return data if isinstance(data, dict) else None
