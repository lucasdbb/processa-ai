"""In-memory rate limiting middleware for FastAPI.

Uses a sliding window counter per IP address. Limits are configurable
per route prefix. Falls back to a global default if no specific limit matches.

For production at scale, consider replacing with Redis-based rate limiting.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.core.logging import logger

# --- Configuration ---

# (max_requests, window_seconds)
ROUTE_LIMITS: dict[str, tuple[int, int]] = {
    # Auth-related (stricter)
    "/api/v1/profiles": (30, 60),
    "/api/v1/users": (30, 60),
    # AI endpoints (expensive)
    "/api/v1/ai": (20, 60),
    # Billing (sensitive)
    "/api/v1/billing/subscriptions": (20, 60),
    "/api/v1/credits": (30, 60),
    # Calculators
    "/api/v1/calculators": (30, 60),
    # Public endpoints (more generous but still limited)
    "/api/v1/blog": (60, 60),
    "/api/v1/newsletter": (10, 60),
    "/api/v1/support": (10, 60),
    "/api/v1/feedback": (10, 60),
}

# Default limit for any /api/ route not matching above
DEFAULT_LIMIT: tuple[int, int] = (60, 60)  # 60 requests per 60 seconds

# --- Sliding window storage ---

_lock = Lock()
# {ip: {route_prefix: [(timestamp, ...)]}}
_request_log: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For from reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_route_limit(path: str) -> tuple[str, int, int]:
    """Find the matching rate limit for a given path.

    Returns (matched_prefix, max_requests, window_seconds).
    """
    for prefix, (max_req, window) in ROUTE_LIMITS.items():
        if path.startswith(prefix):
            return prefix, max_req, window
    return "/api", DEFAULT_LIMIT[0], DEFAULT_LIMIT[1]


def _cleanup_old_entries(entries: list[float], window: float, now: float) -> list[float]:
    """Remove entries outside the sliding window."""
    cutoff = now - window
    return [t for t in entries if t > cutoff]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding window rate limiter per IP per route prefix."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip rate limiting for non-API routes, health, and docs
        if not path.startswith("/api") or path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Skip rate limiting for Stripe webhooks (they have their own auth)
        if path.startswith("/api/v1/billing/webhooks"):
            return await call_next(request)

        ip = _get_client_ip(request)
        prefix, max_requests, window = _get_route_limit(path)
        now = time.time()

        with _lock:
            entries = _request_log[ip][prefix]
            entries = _cleanup_old_entries(entries, window, now)
            _request_log[ip][prefix] = entries

            if len(entries) >= max_requests:
                retry_after = int(window - (now - entries[0])) + 1
                logger.warning(
                    "Rate limit exceeded: ip=%s path=%s limit=%d/%ds",
                    ip,
                    prefix,
                    max_requests,
                    window,
                )
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Too many requests. Please try again later.",
                        "retry_after": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

            entries.append(now)

        response = await call_next(request)

        # Add rate limit headers for transparency
        remaining = max(0, max_requests - len(entries))
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + window))

        return response
