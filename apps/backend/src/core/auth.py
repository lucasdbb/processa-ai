"""Authentication and authorization utilities for the backend."""

from fastapi import Header, HTTPException, Request, status

from src.core.config import settings


def verify_internal_token(x_internal_token: str = Header(...)) -> None:
    """Verify the internal token from the gateway."""
    if x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


def get_user_id(request: Request, x_user_id: str = Header(None)) -> str:
    """Get the user ID from request state (set by middleware) or header."""
    # Try to get from middleware first (JWT)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return user_id

    # Fallback to header (for gateway/proxy)
    if x_user_id:
        return x_user_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User ID not provided",
    )


def get_user_role(request: Request, x_user_role: str = Header(None)) -> str:
    """Get the user role from request state (set by middleware) or header."""
    # Try to get from middleware first (JWT)
    user_role = getattr(request.state, "user_role", None)
    if user_role:
        return user_role

    # Fallback to header (for gateway/proxy)
    if x_user_role:
        return x_user_role

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="User role not provided",
    )


async def require_internal_auth(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """Require internal authentication for service-to-service calls."""
    if not x_internal_token or x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
