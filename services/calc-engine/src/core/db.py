from __future__ import annotations

from typing import Any

try:
    from psycopg_pool import AsyncConnectionPool
except ModuleNotFoundError:  # pragma: no cover
    AsyncConnectionPool = None  # type: ignore[assignment]

from src.core.config import settings

_pool: Any | None = None


async def init_db() -> None:
    global _pool
    if _pool is not None:
        return
    if AsyncConnectionPool is None:
        raise RuntimeError("DB driver not installed")
    _pool = AsyncConnectionPool(
        conninfo=settings.DATABASE_URL,
        min_size=1,
        max_size=5,
        open=False,
    )
    await _pool.open()


async def close_db() -> None:
    global _pool
    if _pool is None:
        return
    pool = _pool
    _pool = None
    await pool.close()


def get_db_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool
