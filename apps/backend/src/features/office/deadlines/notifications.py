"""
Deadline notifications service
Create notifications when deadlines are approaching based on user preferences
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from src.core.logging import logger
from src.core.supabase import get_supabase


class DeadlineNotificationService:
    """Service for creating deadline notifications"""

    def __init__(self):
        self.supabase = get_supabase()

    async def check_upcoming_deadlines(self):
        """
        Check for upcoming deadlines and create notifications

        - Runs daily at 8AM Brazil time
        - Uses reminder_days_before field from each deadline (user preference)
        - Compares dates only (ignores time)
        - Prevents duplicate notifications
        """
        # Get current date in Brazil timezone (date only, no time)
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        today = datetime.now(brazil_tz).date()

        logger.info(f"Checking deadlines for notifications (today: {today})")

        try:
            # Get all pending deadlines (prazos) from events table
            result = (
                self.supabase.table("office_api.events")
                .select("id, user_id, title, processo_id, start_at, reminder_days_before")
                .eq("event_type", "prazo")
                .eq("deadline_status", "pending")
                .execute()
            )

            notifications_created = 0

            for event in result.data:
                # Get due date (date only, no time)
                due_date_str = event["start_at"]
                due_date = datetime.fromisoformat(due_date_str.replace("Z", "+00:00")).date()

                # Get user preference (default 3 days if not set)
                reminder_days = event.get("reminder_days_before", 3)

                # Calculate how many days until deadline
                days_until_deadline = (due_date - today).days

                # Check if we should notify today
                if days_until_deadline == reminder_days:
                    # Check if notification already exists
                    notification_key = f"{event['id']}_{today.isoformat()}"

                    existing = (
                        self.supabase.table("notifications")
                        .select("id")
                        .eq("user_id", event["user_id"])
                        .eq("type", "deadline")
                        .contains(
                            "metadata",
                            {"event_id": event["id"], "notification_date": today.isoformat()},
                        )
                        .execute()
                    )

                    if existing.data:
                        continue  # Already notified

                    # Format message based on days
                    if days_until_deadline == 0:
                        message = "Prazo vence hoje"
                    elif days_until_deadline == 1:
                        message = "Prazo vence amanhã"
                    else:
                        message = f"Prazo vence em {days_until_deadline} dias"

                    # Create notification
                    notification = {
                        "user_id": event["user_id"],
                        "type": "deadline",
                        "title": message,
                        "description": event["title"],
                        "metadata": {
                            "event_id": event["id"],
                            "processo_id": event.get("processo_id"),
                            "due_date": due_date.isoformat(),
                            "notification_date": today.isoformat(),
                            "days_before": reminder_days,
                        },
                    }

                    self.supabase.table("notifications").insert(notification).execute()
                    notifications_created += 1
                    logger.info(
                        f"Created deadline notification: user={event['user_id']}, "
                        f"deadline={event['title']}, days_until={days_until_deadline}"
                    )

            logger.info(f"Deadline check completed: {notifications_created} notifications created")

        except Exception as e:
            logger.error(f"Error checking deadlines: {e}", exc_info=True)
            raise
