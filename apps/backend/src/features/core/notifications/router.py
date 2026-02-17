from fastapi import APIRouter, Depends, Query, status

from src.core.auth import get_user_id, get_user_role, verify_internal_token
from src.features.core.notifications.schemas import (
    NotificationCreate,
    NotificationItem,
    NotificationListResponse,
    NotificationStatsResponse,
)
from src.features.core.notifications.service import NotificationService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = NotificationService()


# User endpoints


@router.get("/notifications", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    user_id: str = Depends(get_user_id),
):
    """List notifications for the authenticated user"""
    return await service.list_user_notifications(user_id, unread_only)


@router.patch("/notifications/{notification_id}/read", response_model=NotificationItem)
async def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(get_user_id),
):
    """Mark a notification as read"""
    return await service.mark_as_read(user_id, notification_id)


@router.patch("/notifications/read-all")
async def mark_all_notifications_as_read(
    user_id: str = Depends(get_user_id),
):
    """Mark all notifications as read"""
    return await service.mark_all_as_read(user_id)


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    user_id: str = Depends(get_user_id),
):
    """Delete a notification"""
    return await service.delete_notification(user_id, notification_id)


# Admin endpoints


@router.post(
    "/admin/notifications",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_user_role)],
)
async def create_notification(
    data: NotificationCreate,
    user_id: str = Depends(get_user_id),
    user_role: str = Depends(get_user_role),
):
    """Create a notification (admin only)"""
    if user_role not in ["admin", "author"]:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and authors can create notifications",
        )

    return await service.create_notification(user_id, data)


@router.get(
    "/admin/notifications/stats",
    response_model=NotificationStatsResponse,
    dependencies=[Depends(get_user_role)],
)
async def get_notification_stats(
    user_role: str = Depends(get_user_role),
):
    """Get notification statistics (admin only)"""
    if user_role not in ["admin", "author"]:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and authors can view stats",
        )

    return await service.get_stats()


@router.get(
    "/admin/notifications",
    response_model=NotificationListResponse,
    dependencies=[Depends(get_user_role)],
)
async def list_all_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user_role: str = Depends(get_user_role),
):
    """List all notifications (admin only)"""
    if user_role not in ["admin", "author"]:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and authors can view all notifications",
        )

    return await service.list_all_notifications(page, page_size)
