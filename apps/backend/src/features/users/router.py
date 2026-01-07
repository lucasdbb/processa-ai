"""
Users routes
"""

from fastapi import APIRouter, Depends, Query

from src.core.dependencies import get_current_admin, get_current_user
from src.features.users.schemas import UpdateProfile, UpdateRoleRequest, UserProfile
from src.features.users.service import UserService

router = APIRouter()
user_service = UserService()


@router.get("/profile", response_model=UserProfile)
async def get_profile(user=Depends(get_current_user)):
    """Get current user profile"""
    return await user_service.get_profile(user.id)


@router.put("/profile", response_model=UserProfile)
async def update_profile(profile_data: UpdateProfile, user=Depends(get_current_user)):
    """Update current user profile"""
    return await user_service.update_profile(user.id, profile_data)


@router.get("/", response_model=list[UserProfile])
async def list_users(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _admin=Depends(get_current_admin),
):
    """List all users (admin only)"""
    return await user_service.list_users(limit=limit, offset=offset)


@router.patch("/update-role")
async def update_role(data: UpdateRoleRequest, _admin=Depends(get_current_admin)):
    return await user_service.update_role(data.userId, data.role)
