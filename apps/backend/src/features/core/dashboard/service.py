from datetime import datetime, timedelta, timezone

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger
from src.core.supabase import get_supabase


class DashboardService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_dashboard_stats(self, user_id: str) -> dict:
        """Get dashboard statistics for user."""
        try:
            pool = await get_pool()
            stats = {}

            first_day_of_month = datetime.now(timezone.utc).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            first_day_prev_month = (first_day_of_month - timedelta(days=1)).replace(day=1)
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            today_end = today_start + timedelta(days=1)

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Get clients count
                    await cur.execute(
                        "SELECT COUNT(*) as total FROM office_api.clients WHERE user_id = %s",
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    stats["total_clients"] = result["total"] if result else 0

                    # Get new clients this month
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total FROM office_api.clients
                        WHERE user_id = %s AND created_at >= %s
                        """,
                        (user_id, first_day_of_month),
                    )
                    result = await cur.fetchone()
                    stats["new_clients_this_month"] = result["total"] if result else 0

                    # Get active processes count
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total FROM office_api.processes
                        WHERE user_id = %s AND status != 'archived'
                        """,
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    stats["active_processes"] = result["total"] if result else 0

                    # Get new processes this month
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total FROM office_api.processes
                        WHERE user_id = %s AND created_at >= %s
                        """,
                        (user_id, first_day_of_month),
                    )
                    result = await cur.fetchone()
                    stats["new_processes_this_month"] = result["total"] if result else 0

                    # Get deadlines for today
                    await cur.execute(
                        """
                        SELECT id, priority FROM office_api.deadlines
                        WHERE user_id = %s AND due_date >= %s AND due_date < %s
                        """,
                        (user_id, today_start.date(), today_end.date()),
                    )
                    deadlines_today = await cur.fetchall()
                    stats["deadlines_today"] = len(deadlines_today)
                    stats["urgent_deadlines_today"] = sum(
                        1 for d in deadlines_today if d.get("priority") == "high"
                    )

                    # Get calculations count this month (from credit transactions)
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total FROM public.credit_transactions
                        WHERE user_id = %s
                          AND transaction_type = 'consume'
                          AND reason LIKE %s
                          AND created_at >= %s
                        """,
                        (user_id, "%calculation%", first_day_of_month),
                    )
                    result = await cur.fetchone()
                    stats["calculations_this_month"] = result["total"] if result else 0

                    # Get previous month calculations for comparison
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total FROM public.credit_transactions
                        WHERE user_id = %s
                          AND transaction_type = 'consume'
                          AND reason LIKE %s
                          AND created_at >= %s
                          AND created_at < %s
                        """,
                        (user_id, "%calculation%", first_day_prev_month, first_day_of_month),
                    )
                    result = await cur.fetchone()
                    prev_month_calculations = result["total"] if result else 0

                    # Calculate percentage change
                    if prev_month_calculations > 0:
                        change_pct = (
                            (stats["calculations_this_month"] - prev_month_calculations)
                            / prev_month_calculations
                            * 100
                        )
                        stats["calculations_change_percent"] = round(change_pct, 1)
                    else:
                        stats["calculations_change_percent"] = (
                            100 if stats["calculations_this_month"] > 0 else 0
                        )

            return stats

        except Exception as e:
            logger.error(f"Failed to get dashboard stats: {e}")
            # Return default values on error
            return {
                "total_clients": 0,
                "new_clients_this_month": 0,
                "active_processes": 0,
                "new_processes_this_month": 0,
                "deadlines_today": 0,
                "urgent_deadlines_today": 0,
                "calculations_this_month": 0,
                "calculations_change_percent": 0,
            }

    async def get_upcoming_deadlines(self, user_id: str, limit: int = 5) -> list:
        """Get upcoming deadlines for user."""
        try:
            pool = await get_pool()
            now = datetime.now(timezone.utc)

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        SELECT
                            d.*,
                            p.process_number,
                            c.name as client_name
                        FROM office_api.deadlines d
                        LEFT JOIN office_api.processes p ON d.process_id = p.id
                        LEFT JOIN office_api.clients c ON p.client_id = c.id
                        WHERE d.user_id = %s
                          AND d.due_date >= %s
                        ORDER BY d.due_date ASC
                        LIMIT %s
                        """,
                        (user_id, now.date(), limit),
                    )
                    rows = await cur.fetchall()

                    deadlines = []
                    for row in rows:
                        due_date = datetime.combine(
                            row["due_date"], datetime.min.time(), tzinfo=timezone.utc
                        )
                        days_left = (due_date - now).days

                        deadlines.append(
                            {
                                "id": str(row["id"]),
                                "type": row.get("type") or "Prazo",
                                "title": row.get("title") or "",
                                "process": row.get("process_number") or "N/A",
                                "client": row.get("client_name") or "N/A",
                                "days_left": days_left,
                                "urgent": row.get("priority") == "high" or days_left <= 1,
                                "due_date": row["due_date"].isoformat(),
                            }
                        )

                    return deadlines

        except Exception as e:
            logger.error(f"Failed to get upcoming deadlines: {e}")
            return []


dashboard_service = DashboardService()
