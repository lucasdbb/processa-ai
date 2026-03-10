"""
Deadline notifications service
Create notifications when deadlines are approaching based on user preferences
"""

import json
from datetime import datetime
from zoneinfo import ZoneInfo

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger


class DeadlineNotificationService:
    """Service for creating deadline notifications"""

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
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Get all pending deadlines (prazos) from events table
                    await cur.execute(
                        """
                        SELECT id, user_id, title, processo_id, start_at, reminder_days_before
                        FROM office_api.events
                        WHERE event_type = 'prazo' AND deadline_status = 'pending'
                        """
                    )
                    events = await cur.fetchall()

                    notifications_created = 0

                    for event in events:
                        # Get due date (date only, no time)
                        due_date = (
                            event["start_at"].date()
                            if hasattr(event["start_at"], "date")
                            else event["start_at"]
                        )

                        # Get user preference (default 3 days if not set)
                        reminder_days = event.get("reminder_days_before") or 3

                        # Calculate how many days until deadline
                        days_until_deadline = (due_date - today).days

                        # Check if we should notify today
                        if days_until_deadline == reminder_days:
                            # Check if notification already exists
                            await cur.execute(
                                """
                                SELECT id FROM public.notifications
                                WHERE user_id = %s AND type = 'deadline'
                                  AND metadata @> %s
                                """,
                                (
                                    event["user_id"],
                                    json.dumps(
                                        {
                                            "event_id": str(event["id"]),
                                            "notification_date": today.isoformat(),
                                        }
                                    ),
                                ),
                            )
                            existing = await cur.fetchone()

                            if existing:
                                continue  # Already notified

                            # Format message based on days
                            if days_until_deadline == 0:
                                message = "Prazo vence hoje"
                            elif days_until_deadline == 1:
                                message = "Prazo vence amanhã"
                            else:
                                message = f"Prazo vence em {days_until_deadline} dias"

                            # Create notification
                            metadata = json.dumps(
                                {
                                    "event_id": str(event["id"]),
                                    "processo_id": str(event["processo_id"])
                                    if event.get("processo_id")
                                    else None,
                                    "due_date": due_date.isoformat(),
                                    "notification_date": today.isoformat(),
                                    "days_before": reminder_days,
                                }
                            )

                            await cur.execute(
                                """
                                INSERT INTO public.notifications (user_id, type, title, description, metadata)
                                VALUES (%s, %s, %s, %s, %s)
                                """,
                                (event["user_id"], "deadline", message, event["title"], metadata),
                            )
                            notifications_created += 1
                            logger.info(
                                f"Created deadline notification: user={event['user_id']}, "
                                f"deadline={event['title']}, days_until={days_until_deadline}"
                            )

            logger.info(f"Deadline check completed: {notifications_created} notifications created")

        except Exception as e:
            logger.error(f"Error checking deadlines: {e}", exc_info=True)
            raise
