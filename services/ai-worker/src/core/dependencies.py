from fastapi import Header, HTTPException, status

from src.core.config import settings


async def require_internal_auth(
    x_internal_token: str | None = Header(default=None),
) -> None:
    if not x_internal_token or x_internal_token != settings.AI_WORKER_INTERNAL_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
