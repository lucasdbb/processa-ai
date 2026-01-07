"""
Authentication routes
"""

from typing import Union

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status

from src.core.dependencies import get_current_user
from src.features.auth.schemas import (
    EmailConfirmationResponse,
    ForgotPassword,
    ResetPassword,
    TokenResponse,
    UserLogin,
    UserRegister,
)
from src.features.auth.service import AuthService
from src.features.users.schemas import UserProfile
from src.features.users.service import UserService

router = APIRouter()
auth_service = AuthService()
user_service = UserService()


def set_auth_cookies(
    response: Response, access_token: str, refresh_token: str, expires_in: int = 3600
):
    """Set httpOnly cookies for authentication tokens"""
    from src.core.config import settings

    # Use SameSite=None for cross-site cookies in production (requires Secure=True)
    # Use SameSite=Lax for same-site in development
    is_production = settings.ENVIRONMENT == "production"

    # Access token cookie (shorter expiration)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,  # True in production (HTTPS required for SameSite=None)
        samesite="none" if is_production else "lax",  # None for cross-site in production
        max_age=expires_in,  # Expires with the token
        path="/",
    )

    # Refresh token cookie (longer expiration - 7 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,  # True in production (HTTPS required for SameSite=None)
        samesite="none" if is_production else "lax",  # None for cross-site in production
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )


def clear_auth_cookies(response: Response):
    """Clear authentication cookies"""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


@router.post(
    "/register",
    response_model=Union[TokenResponse, EmailConfirmationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserRegister, response: Response):
    """Register a new user

    Returns:
        - TokenResponse: If email confirmation is disabled (auto-confirmed)
        - EmailConfirmationResponse: If email confirmation is enabled

    Sets httpOnly cookies for authentication tokens when auto-confirmed
    """
    result = await auth_service.register(user_data)

    # If registration returned tokens (auto-confirmed), set cookies
    if isinstance(result, dict) and "access_token" in result:
        set_auth_cookies(
            response,
            result["access_token"],
            result["refresh_token"],
            result.get("expires_in", 3600),
        )

    return result


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin, response: Response):
    """Login user and set httpOnly cookies"""
    result = await auth_service.login(user_data)

    # Set authentication cookies
    set_auth_cookies(
        response, result["access_token"], result["refresh_token"], result.get("expires_in", 3600)
    )

    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(None),
):
    """Refresh access token and update httpOnly cookies"""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        )

    result = await auth_service.refresh_token(refresh_token)
    set_auth_cookies(
        response,
        result["access_token"],
        result["refresh_token"],
        result.get("expires_in", 3600),
    )
    return result


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(data: ForgotPassword):
    """Send password reset email"""
    return await auth_service.forgot_password(data.email)


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(data: ResetPassword):
    """Reset user password"""
    return await auth_service.reset_password(data)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response):
    """Logout user and clear authentication cookies"""
    clear_auth_cookies(response)
    return {"message": "Logout realizado com sucesso"}


@router.get("/me", response_model=UserProfile)
async def get_current_user_info(user=Depends(get_current_user)):
    """Get current authenticated user information"""
    return await user_service.get_profile(user.id)
