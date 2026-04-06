"""Rate limiting configuration using slowapi.

Provides a shared limiter instance and key functions for use across routers.
"""

from fastapi import Request
from slowapi import Limiter

from src.core.config import settings


def _get_remote_address(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind a reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_user_or_ip(request: Request) -> str:
    """Rate limit by authenticated user_id when available, otherwise by IP."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return _get_remote_address(request)


# Global limiter instance — imported by routers that need custom limits
limiter = Limiter(
    key_func=_get_user_or_ip,
    default_limits=["200/minute"] if settings.ENVIRONMENT == "production" else [],
    storage_uri="memory://",
)
