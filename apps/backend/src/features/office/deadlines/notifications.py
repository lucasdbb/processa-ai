"""
Deadline notifications service
Create notifications when deadlines are approaching
"""
from datetime import datetime, timedelta, timezone

from src.core.logging import logger
from src.core.supabase import get_supabase


class DeadlineNotificationService:
    """Service for creating deadline notifications"""

    def __init__(self):
        self.supabase = get_supabase()

    async def check_upcoming_deadlines(self):
        """
        Check for upcoming deadlines and create notifications
        Should be run daily via cron job
        """
        now = datetime.now(timezone.utc)

        # Check for deadlines in 1 day, 3 days, and 7 days
        check_dates = [
            (now + timedelta(days=1), "vence amanhã"),
            (now + timedelta(days=3), "vence em 3 dias"),
            (now + timedelta(days=7), "vence em 7 dias"),
        ]

        for target_date, message in check_dates:
            target_date_str = target_date.date().isoformat()

            # Get deadlines for this date that haven't been notified yet
            result = (
                self.supabase.table("office_api.deadlines")
                .select("id, user_id, title, process_id, due_date")
                .eq("status", "pending")
                .gte("due_date", target_date_str)
                .lt("due_date", (target_date + timedelta(days=1)).date().isoformat())
                .execute()
            )

            for deadline in result.data:
                # Check if notification already exists for this deadline and date
                existing = (
                    self.supabase.table("notifications")
                    .select("id")
                    .eq("user_id", deadline["user_id"])
                    .eq("type", "deadline")
                    .contains("metadata", {"deadline_id": deadline["id"], "notification_date": target_date_str})
                    .execute()
                )

                if existing.data:
                    continue  # Already notified

                # Create notification
                notification = {
                    "user_id": deadline["user_id"],
                    "type": "deadline",
                    "title": f"Prazo {message}",
                    "description": f"{deadline['title']}",
                    "metadata": {
                        "deadline_id": deadline["id"],
                        "process_id": deadline.get("process_id"),
                        "due_date": deadline["due_date"],
                        "notification_date": target_date_str,
                    },
                }

                self.supabase.table("notifications").insert(notification).execute()
                logger.info(f"Created deadline notification for user {deadline['user_id']}")


# Usage: Run this daily via cron job or scheduled task
# Example cron: 0 8 * * * (every day at 8am)
