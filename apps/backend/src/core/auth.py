"""Authentication and authorization utilities for the backend."""

from fastapi import Header, HTTPException, Request, status, Depends

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


from pydantic import BaseModel
from typing import Optional


class CurrentUser(BaseModel):
    id: str
    role: str


def get_current_user(request: Request) -> CurrentUser:
    """Dependency to get the current authenticated user."""
    user_id = getattr(request.state, "user_id", None)
    user_role = getattr(request.state, "user_role", "client")

    if not user_id:
        # Check header fallback
        user_id = request.headers.get("x-user-id")
        user_role = request.headers.get("x-user-role", "client")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return CurrentUser(id=user_id, role=user_role)


def get_current_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency to require admin privileges."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user


async def require_internal_auth(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """Require internal authentication for service-to-service calls."""
    if not x_internal_token or x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
