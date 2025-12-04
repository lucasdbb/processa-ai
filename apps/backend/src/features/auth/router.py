"""
Authentication routes
"""
from typing import Union

from fastapi import APIRouter, Depends, status

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


@router.post(
    "/register",
    response_model=Union[TokenResponse, EmailConfirmationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserRegister):
    """Register a new user

    Returns:
        - TokenResponse: If email confirmation is disabled (auto-confirmed)
        - EmailConfirmationResponse: If email confirmation is enabled
    """
    return await auth_service.register(user_data)


@router.post("/login", response_model=TokenResponse)
async def login(user_data: UserLogin):
    """Login user"""
    return await auth_service.login(user_data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    """Refresh access token"""
    return await auth_service.refresh_token(refresh_token)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(data: ForgotPassword):
    """Send password reset email"""
    return await auth_service.forgot_password(data.email)


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(data: ResetPassword):
    """Reset user password"""
    return await auth_service.reset_password(data)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout():
    """Logout user (client-side token removal)"""
    return {"message": "Logout realizado com sucesso"}


@router.get("/me", response_model=UserProfile)
async def get_current_user_info(user=Depends(get_current_user)):
    """Get current authenticated user information"""
    return await user_service.get_profile(user.id)
