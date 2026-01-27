from fastapi import APIRouter, Depends, Header, Query

from src.core.auth import get_user_id, verify_internal_token
from src.features.profiles.schemas import UpdateProfile, UpdateRoleRequest, UserProfile
from src.features.profiles.service import profiles_service

router = APIRouter(dependencies=[Depends(verify_internal_token)])


@router.get("/me", response_model=UserProfile)
async def get_my_profile(user_id: str = Depends(get_user_id)):
    """Get current user's profile."""
    return await profiles_service.get_profile(user_id)


@router.put("/me", response_model=UserProfile)
async def update_my_profile(
    data: UpdateProfile,
    user_id: str = Depends(get_user_id),
):
    """Update current user's profile."""
    return await profiles_service.update_profile(user_id, data)


@router.get("/", response_model=list[UserProfile])
async def list_profiles(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_user_role: str = Header("user"),
):
    """List all profiles (admin only)."""
    if x_user_role != "admin":
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.list_profiles(limit=limit, offset=offset)


@router.patch("/role")
async def update_role(
    data: UpdateRoleRequest,
    x_user_role: str = Header("user"),
):
    """Update user role (admin only)."""
    if x_user_role != "admin":
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.update_role(data.user_id, data.role)
