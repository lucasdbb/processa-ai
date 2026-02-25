from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.core.supabase import get_supabase
from src.features.core.notifications.schemas import (
    NotificationCreate,
    NotificationItem,
    NotificationListResponse,
    NotificationStatsResponse,
)


class NotificationService:
    """Service for managing notifications"""

    def __init__(self):
        self.supabase = get_supabase()

    async def list_user_notifications(
        self, user_id: str, unread_only: bool = False
    ) -> NotificationListResponse:
        """List notifications for a user"""
        query = self.supabase.table("notifications").select("*").eq("user_id", user_id)

        if unread_only:
            query = query.eq("read", False)

        result = query.order("created_at", desc=True).execute()

        # Get unread count
        unread_result = (
            self.supabase.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("read", False)
            .execute()
        )

        items = [NotificationItem(**item) for item in result.data]

        return NotificationListResponse(
            items=items,
            total=len(result.data),
            unread_count=unread_result.count or 0,
        )

    async def mark_as_read(self, user_id: str, notification_id: str) -> NotificationItem:
        """Mark a notification as read"""
        # Verify ownership
        existing = (
            self.supabase.table("notifications")
            .select("*")
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        # Update
        result = (
            self.supabase.table("notifications")
            .update(
                {
                    "read": True,
                    "read_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id", notification_id)
            .execute()
        )

        return NotificationItem(**result.data[0])

    async def mark_all_as_read(self, user_id: str) -> dict:
        """Mark all notifications as read for a user"""
        result = (
            self.supabase.table("notifications")
            .update(
                {
                    "read": True,
                    "read_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("user_id", user_id)
            .eq("read", False)
            .execute()
        )

        return {"updated": len(result.data)}

    async def delete_notification(self, user_id: str, notification_id: str) -> dict:
        """Delete a notification"""
        # Verify ownership
        existing = (
            self.supabase.table("notifications")
            .select("*")
            .eq("id", notification_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        self.supabase.table("notifications").delete().eq("id", notification_id).execute()

        return {"deleted": True}

    # Admin endpoints

    async def create_notification(self, admin_id: str, data: NotificationCreate) -> dict:
        """Create notification(s) (admin only)"""
        # If user_id is None, send to all users
        if data.user_id is None:
            # Get all user IDs
            users_result = self.supabase.table("profiles").select("id").execute()
            user_ids = [user["id"] for user in users_result.data]

            # Create notification for each user
            notifications = [
                {
                    "user_id": uid,
                    "type": data.type,
                    "title": data.title,
                    "description": data.description,
                    "metadata": data.metadata or {},
                }
                for uid in user_ids
            ]

            result = self.supabase.table("notifications").insert(notifications).execute()
            return {"created": len(result.data), "recipients": user_ids}
        else:
            # Create notification for specific user
            notification = {
                "user_id": data.user_id,
                "type": data.type,
                "title": data.title,
                "description": data.description,
                "metadata": data.metadata or {},
            }

            result = self.supabase.table("notifications").insert(notification).execute()
            return {"created": 1, "recipients": [data.user_id]}

    async def get_stats(self) -> NotificationStatsResponse:
        """Get notification statistics (admin only)"""
        # Total sent
        total_result = self.supabase.table("notifications").select("id", count="exact").execute()

        # Total read
        read_result = (
            self.supabase.table("notifications")
            .select("id", count="exact")
            .eq("read", True)
            .execute()
        )

        # Total unread
        unread_result = (
            self.supabase.table("notifications")
            .select("id", count="exact")
            .eq("read", False)
            .execute()
        )

        return NotificationStatsResponse(
            total_sent=total_result.count or 0,
            total_read=read_result.count or 0,
            total_unread=unread_result.count or 0,
        )

    async def list_all_notifications(
        self, page: int = 1, page_size: int = 50
    ) -> NotificationListResponse:
        """List all notifications (admin only) - paginated"""
        offset = (page - 1) * page_size

        # Get paginated results
        result = (
            self.supabase.table("notifications")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + page_size - 1)
            .execute()
        )

        # Get total count and unread count
        count_result = self.supabase.table("notifications").select("id", count="exact").execute()

        unread_result = (
            self.supabase.table("notifications")
            .select("id", count="exact")
            .eq("read", False)
            .execute()
        )

        items = [NotificationItem(**item) for item in result.data]

        return NotificationListResponse(
            items=items,
            total=count_result.count or 0,
            unread_count=unread_result.count or 0,
        )
