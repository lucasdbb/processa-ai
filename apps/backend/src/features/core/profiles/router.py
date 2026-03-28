from fastapi import APIRouter, Depends, Query

from src.core.auth import get_user_id, get_user_role, verify_internal_token
from src.features.core.profiles.schemas import (
    AddCreditsRequest,
    UpdateOnboarding,
    UpdatePlanRequest,
    UpdateProfile,
    UpdateRoleRequest,
    UpdateStatusRequest,
    UserProfile,
)
from src.features.core.profiles.service import profiles_service

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


@router.patch("/me/onboarding")
async def update_onboarding(
    data: UpdateOnboarding,
    user_id: str = Depends(get_user_id),
):
    """Update onboarding flags (has_used_ai_tool, has_used_calculator, checklist_dismissed)."""
    return await profiles_service.update_onboarding(user_id, data.model_dump(exclude_none=True))


@router.delete("/me")
async def delete_my_account(user_id: str = Depends(get_user_id)):
    """Delete current user's account and all related data."""
    return await profiles_service.delete_account(user_id)


@router.get("/", response_model=list[UserProfile])
async def list_profiles(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_role: str = Depends(get_user_role),
):
    """List all profiles (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.list_profiles(limit=limit, offset=offset)


@router.patch("/update-user")
async def update_user(
    data: UpdateRoleRequest,
    user_role: str = Depends(get_user_role),
):
    """Update user role, credits, and plan (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.update_role(
        data.user_id,
        data.role,
        data.subscription_credits,
        data.purchased_credits,
        data.plan_id,
    )


@router.patch("/update-role")
async def update_role_deprecated(
    data: UpdateRoleRequest,
    user_role: str = Depends(get_user_role),
):
    """[DEPRECATED] Use /update-user instead. Update user role, credits, and plan (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    # Use legacy credits field if new fields not provided
    sub_credits = (
        data.subscription_credits if data.subscription_credits is not None else data.credits
    )
    return await profiles_service.update_role(
        data.user_id, data.role, sub_credits, data.purchased_credits, data.plan_id
    )


@router.patch("/update-status")
async def update_status(
    data: UpdateStatusRequest,
    user_role: str = Depends(get_user_role),
):
    """Update user status (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.update_status(data.user_id, data.status)


@router.post("/admin/users/{user_id}/credits")
async def add_user_credits(
    user_id: str,
    data: AddCreditsRequest,
    user_role: str = Depends(get_user_role),
):
    """Add credits to a user (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.add_credits(user_id, data.amount)


@router.patch("/admin/users/{user_id}/plan")
async def update_user_plan(
    user_id: str,
    data: UpdatePlanRequest,
    user_role: str = Depends(get_user_role),
):
    """Update user's plan (admin only)."""
    if user_role != "admin":
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return await profiles_service.update_plan(user_id, data.plan_id)
