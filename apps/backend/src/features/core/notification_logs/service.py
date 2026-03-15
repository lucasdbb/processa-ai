"""
Service for logging and querying outbound notifications (email, WhatsApp).
"""

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger


class NotificationLogService:
    """Handles logging of outbound notifications and admin queries."""

    async def log(
        self,
        user_id: str,
        channel: str,
        recipient: str,
        notification_type: str,
        status: str,
        subject: str | None = None,
        external_id: str | None = None,
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> str | None:
        """
        Insert a notification log record.
        Returns the log ID or None on error.
        """
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        INSERT INTO public.notification_logs
                            (user_id, channel, recipient, notification_type,
                             subject, status, external_id, error_message, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            user_id,
                            channel,
                            recipient,
                            notification_type,
                            subject,
                            status,
                            external_id,
                            error_message,
                            metadata or {},
                        ),
                    )
                    row = await cur.fetchone()
                    return str(row["id"]) if row else None
        except Exception as e:
            logger.error(f"Failed to log notification: {e}")
            return None

    async def update_status(
        self,
        external_id: str,
        status: str,
        error_message: str | None = None,
    ) -> bool:
        """Update a log's status by external ID (Twilio SID)."""
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        UPDATE public.notification_logs
                        SET status = %s, error_message = COALESCE(%s, error_message),
                            updated_at = now()
                        WHERE external_id = %s
                        """,
                        (status, error_message, external_id),
                    )
                    return cur.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to update notification log status: {e}")
            return False

    async def list_logs(
        self,
        limit: int = 50,
        offset: int = 0,
        channel: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> dict:
        """List notification logs with filters (admin). Returns {items, total}."""
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    where_clauses = []
                    params: list = []

                    if channel:
                        where_clauses.append("nl.channel = %s")
                        params.append(channel)
                    if status:
                        where_clauses.append("nl.status = %s")
                        params.append(status)
                    if search:
                        where_clauses.append(
                            "(nl.recipient ILIKE %s OR nl.subject ILIKE %s OR p.name ILIKE %s OR p.email ILIKE %s)"
                        )
                        like = f"%{search}%"
                        params.extend([like, like, like, like])

                    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

                    # Count
                    await cur.execute(
                        f"""
                        SELECT COUNT(*) AS total
                        FROM public.notification_logs nl
                        LEFT JOIN public.profiles p ON p.id = nl.user_id
                        {where_sql}
                        """,
                        params,
                    )
                    total = (await cur.fetchone())["total"]

                    # Items
                    await cur.execute(
                        f"""
                        SELECT nl.id, nl.user_id, nl.channel, nl.recipient,
                               nl.notification_type, nl.subject, nl.status,
                               nl.error_message, nl.created_at, nl.updated_at,
                               p.name AS user_name, p.email AS user_email
                        FROM public.notification_logs nl
                        LEFT JOIN public.profiles p ON p.id = nl.user_id
                        {where_sql}
                        ORDER BY nl.created_at DESC
                        LIMIT %s OFFSET %s
                        """,
                        [*params, limit, offset],
                    )
                    items = await cur.fetchall()

                    return {
                        "items": [
                            {
                                **item,
                                "id": str(item["id"]),
                                "user_id": str(item["user_id"]),
                            }
                            for item in items
                        ],
                        "total": total,
                    }
        except Exception as e:
            logger.error(f"Failed to list notification logs: {e}")
            return {"items": [], "total": 0}

    async def get_stats(self) -> dict:
        """Get notification log statistics (admin)."""
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute("""
                        SELECT
                            COUNT(*) AS total,
                            COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h,
                            COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d,
                            COUNT(*) FILTER (WHERE status = 'failed') AS failed_total
                        FROM public.notification_logs
                    """)
                    overview = await cur.fetchone()

                    await cur.execute("""
                        SELECT channel, COUNT(*) AS count
                        FROM public.notification_logs
                        GROUP BY channel
                    """)
                    by_channel = {row["channel"]: row["count"] for row in await cur.fetchall()}

                    await cur.execute("""
                        SELECT status, COUNT(*) AS count
                        FROM public.notification_logs
                        GROUP BY status
                    """)
                    by_status = {row["status"]: row["count"] for row in await cur.fetchall()}

                    total = overview["total"]
                    failed = overview["failed_total"]

                    return {
                        "total": total,
                        "by_channel": by_channel,
                        "by_status": by_status,
                        "last_24h": overview["last_24h"],
                        "last_7d": overview["last_7d"],
                        "failure_rate": round(failed / total * 100, 1) if total > 0 else 0,
                    }
        except Exception as e:
            logger.error(f"Failed to get notification log stats: {e}")
            return {
                "total": 0,
                "by_channel": {},
                "by_status": {},
                "last_24h": 0,
                "last_7d": 0,
                "failure_rate": 0,
            }


notification_log_service = NotificationLogService()
