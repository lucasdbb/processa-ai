from fastapi import Header, HTTPException, status

from src.core.config import settings


async def verify_internal_token(
    x_internal_token: str = Header(..., alias="X-Internal-Token"),
) -> None:
    """Verify the internal token for service-to-service communication."""
    if x_internal_token != settings.OFFICE_API_INTERNAL_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


async def get_user_id(
    x_user_id: str = Header(..., alias="X-User-Id"),
) -> str:
    """Extract user ID from header (passed by gateway)."""
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not provided",
        )
    return x_user_id
