"""Middleware for processing authentication headers from Supabase JWT."""

import time

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.config import settings
from src.core.logging import logger
from src.core.supabase import get_supabase

# In-memory role cache: {user_id: (role, timestamp)}
_role_cache: dict[str, tuple[str, float]] = {}
_ROLE_CACHE_TTL_S = 300  # 5 minutes


def _get_cached_role(user_id: str) -> str | None:
    """Return cached role if still valid, else None."""
    entry = _role_cache.get(user_id)
    if entry is None:
        return None
    role, ts = entry
    if time.time() - ts > _ROLE_CACHE_TTL_S:
        del _role_cache[user_id]
        return None
    return role


def _set_cached_role(user_id: str, role: str) -> None:
    """Cache a user role with current timestamp."""
    _role_cache[user_id] = (role, time.time())


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    """Extract user_id from Supabase JWT and fetch role from profiles table."""

    async def dispatch(self, request: Request, call_next):
        # Skip middleware for docs and health check
        if request.url.path in ["/", "/docs", "/redoc", "/openapi.json", "/health"]:
            return await call_next(request)

        # Get Authorization header
        auth_header = request.headers.get("Authorization", "")

        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")

            try:
                # Verify JWT signature with Supabase JWT secret
                if settings.SUPABASE_JWT_SECRET:
                    decoded = jwt.decode(
                        token,
                        settings.SUPABASE_JWT_SECRET,
                        algorithms=["HS256"],
                        options={"verify_exp": True},
                        audience="authenticated",
                    )
                else:
                    logger.warning(
                        "SUPABASE_JWT_SECRET not set — JWT signature NOT verified. "
                        "This is insecure and must not be used in production."
                    )
                    decoded = jwt.decode(token, options={"verify_signature": False})

                # Extract user ID from JWT
                user_id = decoded.get("sub")  # subject = user_id

                if user_id:
                    # Try cache first, fallback to DB lookup
                    user_role = _get_cached_role(user_id)

                    if user_role is None:
                        try:
                            supabase = get_supabase()
                            response = (
                                supabase.table("profiles")
                                .select("role")
                                .eq("id", user_id)
                                .single()
                                .execute()
                            )

                            user_role = (
                                response.data.get("role", "client")
                                if response.data
                                else "client"
                            )
                            _set_cached_role(user_id, user_role)
                        except Exception as e:
                            logger.warning(f"Failed to fetch user role from profiles: {e}")
                            user_role = "client"

                    # Add to request state so it can be accessed by dependencies
                    request.state.user_id = user_id
                    request.state.user_role = user_role

                    logger.debug(f"Auth middleware: user_id={user_id}, role={user_role}")

            except jwt.InvalidTokenError as e:
                logger.warning(f"Invalid JWT token: {e}")
            except Exception as e:
                logger.error(f"Error decoding JWT: {e}")

        response = await call_next(request)
        return response
