"""
Deadline notifications service.
Creates in-app notifications and sends email reminders when deadlines approach.
Also provides a weekly summary of upcoming deadlines.
"""

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.email import send_deadline_reminder, send_weekly_deadline_summary
from src.core.logging import logger
from src.core.whatsapp import send_deadline_whatsapp
from src.features.core.notification_logs.service import notification_log_service


class DeadlineNotificationService:
    """Service for creating deadline notifications and sending email reminders."""

    async def check_upcoming_deadlines(self):
        """
        Check for upcoming deadlines, create in-app notifications,
        and send ONE consolidated email per user.

        - Runs daily at 8AM Brazil time
        - Uses reminder_days_before field from each deadline (user preference)
        - Compares dates only (ignores time)
        - Prevents duplicate notifications
        - Groups all deadlines per user into a single email
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        today = datetime.now(brazil_tz).date()

        logger.info(f"Checking deadlines for notifications (today: {today})")

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        SELECT e.id, e.user_id, e.title, e.processo_id,
                               e.start_at, e.reminder_days_before,
                               p.email AS user_email, p.name AS user_name,
                               p.phone AS user_phone, p.whatsapp_opt_in,
                               s.plan_id AS user_plan
                        FROM office_api.events e
                        JOIN public.profiles p ON p.id = e.user_id
                        LEFT JOIN public.subscriptions s
                          ON s.user_id = e.user_id AND s.status = 'active'
                        WHERE e.event_type = 'prazo' AND e.deadline_status = 'pending'
                        """
                    )
                    events = await cur.fetchall()

                    notifications_created = 0
                    # Collect deadlines per user for consolidated email
                    user_deadlines: dict[str, dict] = {}

                    for event in events:
                        due_date = (
                            event["start_at"].date()
                            if hasattr(event["start_at"], "date")
                            else event["start_at"]
                        )

                        reminder_days = event.get("reminder_days_before") or 3
                        days_until_deadline = (due_date - today).days

                        if days_until_deadline != reminder_days:
                            continue

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
                        if await cur.fetchone():
                            continue

                        # Format message for in-app notification
                        if days_until_deadline == 0:
                            message = "Prazo vence hoje"
                        elif days_until_deadline == 1:
                            message = "Prazo vence amanhã"
                        else:
                            message = f"Prazo vence em {days_until_deadline} dias"

                        # Create in-app notification
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

                        # Accumulate for consolidated email / WhatsApp
                        user_id = event["user_id"]
                        if user_id not in user_deadlines:
                            user_deadlines[user_id] = {
                                "email": event["user_email"],
                                "name": event.get("user_name"),
                                "phone": event.get("user_phone"),
                                "whatsapp_opt_in": event.get("whatsapp_opt_in", False),
                                "plan": event.get("user_plan"),
                                "deadlines": [],
                            }
                        user_deadlines[user_id]["deadlines"].append(
                            {
                                "title": event["title"],
                                "days_until": days_until_deadline,
                                "due_date_str": due_date.strftime("%d/%m/%Y"),
                            }
                        )

            # Send one consolidated email per user (outside the DB transaction)
            emails_sent = 0
            whatsapp_sent = 0

            def deadline_titles(ds):
                return ", ".join(d["title"] for d in ds)

            for user_id, data in user_deadlines.items():
                subject = f"Lembrete de prazo ({len(data['deadlines'])} prazo(s))"

                # Email (all deadlines)
                try:
                    sent = await send_deadline_reminder(
                        to_email=data["email"],
                        user_name=data["name"],
                        deadlines=data["deadlines"],
                    )
                    await notification_log_service.log(
                        user_id=user_id,
                        channel="email",
                        recipient=data["email"],
                        notification_type="deadline_reminder",
                        subject=subject,
                        status="sent" if sent else "failed",
                        error_message=None if sent else "Brevo send failed",
                        metadata={"deadline_count": len(data["deadlines"])},
                    )
                    if sent:
                        emails_sent += 1
                except Exception as email_err:
                    logger.error(f"Error sending deadline email to {data['email']}: {email_err}")
                    await notification_log_service.log(
                        user_id=user_id,
                        channel="email",
                        recipient=data["email"],
                        notification_type="deadline_reminder",
                        subject=subject,
                        status="failed",
                        error_message=str(email_err),
                    )

                # WhatsApp (only urgent deadlines, autonomo plan only)
                if data["whatsapp_opt_in"] and data["phone"] and data["plan"] == "autonomo":
                    urgent = [d for d in data["deadlines"] if d["days_until"] <= 1]
                    if urgent:
                        try:
                            result = await send_deadline_whatsapp(
                                to_phone=data["phone"],
                                user_name=data["name"],
                                deadlines=urgent,
                            )
                            await notification_log_service.log(
                                user_id=user_id,
                                channel="whatsapp",
                                recipient=data["phone"],
                                notification_type="deadline_urgent",
                                subject=deadline_titles(urgent),
                                status="sent" if result.success else "failed",
                                external_id=result.sid,
                                error_message=result.error if not result.success else None,
                                metadata={"deadline_count": len(urgent)},
                            )
                            if result.success:
                                whatsapp_sent += 1
                        except Exception as wa_err:
                            logger.error(f"Error sending WhatsApp to {data['phone']}: {wa_err}")
                            await notification_log_service.log(
                                user_id=user_id,
                                channel="whatsapp",
                                recipient=data["phone"],
                                notification_type="deadline_urgent",
                                subject=deadline_titles(urgent),
                                status="failed",
                                error_message=str(wa_err),
                            )

            logger.info(
                f"Deadline check completed: {notifications_created} notifications created, "
                f"{emails_sent} emails sent, {whatsapp_sent} WhatsApp sent"
            )

        except Exception as e:
            logger.error(f"Error checking deadlines: {e}", exc_info=True)
            raise

    async def send_weekly_summary(self):
        """
        Send a weekly email summary of all pending deadlines due in the next 7 days.

        - Runs every Monday at 8AM Brazil time
        - One email per user with all their upcoming deadlines
        - Does NOT create in-app notifications (those are handled by the daily check)
        """
        brazil_tz = ZoneInfo("America/Sao_Paulo")
        today = datetime.now(brazil_tz).date()
        next_week = today + timedelta(days=7)

        logger.info(f"Generating weekly deadline summary (today: {today}, until: {next_week})")

        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        SELECT e.user_id, e.title, e.start_at,
                               p.email AS user_email, p.name AS user_name
                        FROM office_api.events e
                        JOIN public.profiles p ON p.id = e.user_id
                        WHERE e.event_type = 'prazo'
                          AND e.deadline_status = 'pending'
                          AND e.start_at::date >= %s
                          AND e.start_at::date <= %s
                        ORDER BY e.start_at
                        """,
                        (today, next_week),
                    )
                    events = await cur.fetchall()

            # Group by user
            users: dict[str, dict] = {}
            for event in events:
                due_date = (
                    event["start_at"].date()
                    if hasattr(event["start_at"], "date")
                    else event["start_at"]
                )
                days_until = (due_date - today).days

                user_id = event["user_id"]
                if user_id not in users:
                    users[user_id] = {
                        "email": event["user_email"],
                        "name": event.get("user_name"),
                        "deadlines": [],
                    }
                users[user_id]["deadlines"].append(
                    {
                        "title": event["title"],
                        "days_until": days_until,
                        "due_date_str": due_date.strftime("%d/%m/%Y"),
                    }
                )

            # Send one summary email per user
            emails_sent = 0
            for user_id, data in users.items():
                subject = f"Resumo semanal: {len(data['deadlines'])} prazo(s)"
                try:
                    sent = await send_weekly_deadline_summary(
                        to_email=data["email"],
                        user_name=data["name"],
                        deadlines=data["deadlines"],
                    )
                    await notification_log_service.log(
                        user_id=user_id,
                        channel="email",
                        recipient=data["email"],
                        notification_type="weekly_summary",
                        subject=subject,
                        status="sent" if sent else "failed",
                        error_message=None if sent else "Brevo send failed",
                        metadata={"deadline_count": len(data["deadlines"])},
                    )
                    if sent:
                        emails_sent += 1
                except Exception as email_err:
                    logger.error(f"Error sending weekly summary to {data['email']}: {email_err}")
                    await notification_log_service.log(
                        user_id=user_id,
                        channel="email",
                        recipient=data["email"],
                        notification_type="weekly_summary",
                        subject=subject,
                        status="failed",
                        error_message=str(email_err),
                    )

            logger.info(
                f"Weekly summary completed: {emails_sent} emails sent to "
                f"{len(users)} users with deadlines"
            )

        except Exception as e:
            logger.error(f"Error sending weekly summary: {e}", exc_info=True)
            raise
