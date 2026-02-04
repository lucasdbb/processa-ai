from psycopg_pool import AsyncConnectionPool

from src.core.config import settings
from src.core.logging import logger

_pool: AsyncConnectionPool | None = None


async def init_db() -> None:
    global _pool
    if _pool is not None:
        return

    logger.info("Initializing database connection pool")
    _pool = AsyncConnectionPool(
        conninfo=settings.DATABASE_URL,
        min_size=1,
        max_size=10,
        open=False,
        kwargs={
            "prepare_threshold": None,  # None = nunca usa prepared statements
            "options": "-c jit=off",  # Desabilita JIT compilation para melhor performance
        },
    )
    await _pool.open()
    logger.info("Database connection pool initialized")


async def close_db() -> None:
    global _pool
    if _pool is None:
        return

    logger.info("Closing database connection pool")
    await _pool.close()
    _pool = None
    logger.info("Database connection pool closed")


async def get_pool() -> AsyncConnectionPool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _pool
