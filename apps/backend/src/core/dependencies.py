"""
FastAPI dependencies for authentication and authorization
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.shared.database import get_supabase

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Dependency to get current authenticated user from JWT token

    Usage:
        @router.get("/profile")
        async def get_profile(user = Depends(get_current_user)):
            return user

    Returns:
        dict: User data from Supabase Auth
            - id: User UUID
            - email: User email
            - user_metadata: User metadata (full_name, role, etc.)
    """
    supabase = get_supabase()

    try:
        # Get user from token
        user = supabase.auth.get_user(credentials.credentials)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido ou expirado",
            )

        return user.user

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )


async def get_current_admin(
    user=Depends(get_current_user),
):
    supabase = get_supabase()

    try:
        profile_response = (
            supabase.table("profiles").select("role").eq("id", user.id).execute()
        )

        role = None
        if profile_response.data:
            role = profile_response.data[0].get("role")
        else:
            role = user.user_metadata.get("role", "user")

        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado. Apenas administradores.",
            )

        return user
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado. Apenas administradores.",
        )
