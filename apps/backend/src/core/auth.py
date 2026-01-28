"""Authentication and authorization utilities for the backend."""

from fastapi import Header, HTTPException, status

from src.core.config import settings


def verify_internal_token(x_internal_token: str = Header(...)) -> None:
    """Verify the internal token from the gateway."""
    if x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


def get_user_id(x_user_id: str = Header(...)) -> str:
    """Get the user ID from the gateway header."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not provided",
        )
    return x_user_id


async def require_internal_auth(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """Require internal authentication for service-to-service calls."""
    if not x_internal_token or x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
