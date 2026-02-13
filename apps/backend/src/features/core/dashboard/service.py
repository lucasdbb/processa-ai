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
                        SELECT id, priority FROM office_api.events
                        WHERE user_id = %s AND event_type = 'prazo' AND deadline_status = 'pending'
                          AND start_at::date >= %s AND start_at::date < %s
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
                            e.id, e.user_id, e.processo_id as process_id, e.title, e.description,
                            e.start_at as due_date, e.priority, e.deadline_status as status,
                            e.completed_at, e.reminder_days_before, e.created_at, e.updated_at,
                            p.process_number,
                            c.name as client_name
                        FROM office_api.events e
                        LEFT JOIN office_api.processes p ON e.processo_id = p.id
                        LEFT JOIN office_api.clients c ON p.client_id = c.id
                        WHERE e.user_id = %s AND e.event_type = 'prazo' AND e.deadline_status = 'pending'
                          AND e.start_at::date >= %s
                        ORDER BY e.start_at ASC
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

    async def get_financial_stats(self, user_id: str) -> dict:
        """Get financial statistics for user."""
        try:
            pool = await get_pool()
            now = datetime.now(timezone.utc)

            # Calculate last 6 months range
            months = []
            for i in range(5, -1, -1):
                month_date = now - timedelta(days=30 * i)
                month_str = month_date.strftime("%Y-%m")
                months.append(month_str)

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Get total fees
                    await cur.execute(
                        """
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM office_api.fees
                        WHERE user_id = %s
                        """,
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    total_fees = float(result["total"]) if result else 0.0

                    # Get total received
                    await cur.execute(
                        """
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'paid'
                        """,
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    total_received = float(result["total"]) if result else 0.0

                    # Get total pending
                    await cur.execute(
                        """
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'pending'
                        """,
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    total_pending = float(result["total"]) if result else 0.0

                    # Get total overdue
                    await cur.execute(
                        """
                        SELECT COALESCE(SUM(amount), 0) as total
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'overdue'
                        """,
                        (user_id,),
                    )
                    result = await cur.fetchone()
                    total_overdue = float(result["total"]) if result else 0.0

                    # Get monthly revenue (last 6 months)
                    monthly_revenue = []
                    for month_str in months:
                        year, month = month_str.split("-")
                        start_date = f"{year}-{month}-01"

                        # Calculate end date (first day of next month)
                        if month == "12":
                            end_date = f"{int(year)+1}-01-01"
                        else:
                            end_date = f"{year}-{int(month)+1:02d}-01"

                        # Get received amount for this month
                        await cur.execute(
                            """
                            SELECT COALESCE(SUM(amount), 0) as total
                            FROM office_api.fees
                            WHERE user_id = %s
                              AND status = 'paid'
                              AND paid_date >= %s
                              AND paid_date < %s
                            """,
                            (user_id, start_date, end_date),
                        )
                        result = await cur.fetchone()
                        received = float(result["total"]) if result else 0.0

                        # Get pending amount for this month
                        await cur.execute(
                            """
                            SELECT COALESCE(SUM(amount), 0) as total
                            FROM office_api.fees
                            WHERE user_id = %s
                              AND status IN ('pending', 'overdue')
                              AND due_date >= %s
                              AND due_date < %s
                            """,
                            (user_id, start_date, end_date),
                        )
                        result = await cur.fetchone()
                        pending = float(result["total"]) if result else 0.0

                        monthly_revenue.append(
                            {"month": month_str, "received": received, "pending": pending}
                        )

                    # Get breakdown by status
                    await cur.execute(
                        """
                        SELECT
                            status,
                            COUNT(*) as count,
                            COALESCE(SUM(amount), 0) as total
                        FROM office_api.fees
                        WHERE user_id = %s
                        GROUP BY status
                        """,
                        (user_id,),
                    )
                    status_rows = await cur.fetchall()

                    by_status = {}
                    for row in status_rows:
                        by_status[row["status"]] = {
                            "count": row["count"],
                            "total": float(row["total"]),
                        }

                    # Get aging breakdown (overdue)
                    aging = {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "90_plus": 0.0}

                    await cur.execute(
                        """
                        SELECT
                            due_date,
                            amount as overdue_amount
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'overdue'
                        """,
                        (user_id,),
                    )
                    overdue_rows = await cur.fetchall()

                    for row in overdue_rows:
                        due_date = row["due_date"]
                        days_overdue = (now.date() - due_date).days
                        amount = float(row["overdue_amount"])

                        if days_overdue <= 30:
                            aging["0_30"] += amount
                        elif days_overdue <= 60:
                            aging["31_60"] += amount
                        elif days_overdue <= 90:
                            aging["61_90"] += amount
                        else:
                            aging["90_plus"] += amount

            return {
                "total_fees": total_fees,
                "total_received": total_received,
                "total_pending": total_pending,
                "total_overdue": total_overdue,
                "monthly_revenue": monthly_revenue,
                "by_status": by_status,
                "aging": aging,
            }

        except Exception as e:
            logger.error(f"Failed to get financial stats: {e}")
            return {
                "total_fees": 0.0,
                "total_received": 0.0,
                "total_pending": 0.0,
                "total_overdue": 0.0,
                "monthly_revenue": [],
                "by_status": {},
                "aging": {"0_30": 0.0, "31_60": 0.0, "61_90": 0.0, "90_plus": 0.0},
            }

    async def get_processes_summary(self, user_id: str) -> dict:
        """Get processes summary for user."""
        try:
            pool = await get_pool()

            status_labels = {
                "active": "Ativos",
                "pending": "Pendentes",
                "suspended": "Suspensos",
                "concluded": "Concluídos",
                "cancelled": "Cancelados",
                "archived": "Arquivados",
            }

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Get count by status
                    await cur.execute(
                        """
                        SELECT status, COUNT(*) as count
                        FROM office_api.processes
                        WHERE user_id = %s
                        GROUP BY status
                        """,
                        (user_id,),
                    )
                    rows = await cur.fetchall()

                    by_status = []
                    total = 0
                    for row in rows:
                        status = row["status"]
                        count = row["count"]
                        total += count

                        by_status.append(
                            {
                                "status": status,
                                "count": count,
                                "label": status_labels.get(status, status.capitalize()),
                            }
                        )

            return {"by_status": by_status, "total": total}

        except Exception as e:
            logger.error(f"Failed to get processes summary: {e}")
            return {"by_status": [], "total": 0}

    async def get_recent_activity(self, user_id: str, limit: int = 10) -> list:
        """Get recent activity for user."""
        try:
            pool = await get_pool()
            now = datetime.now(timezone.utc)

            # Event type labels
            event_type_labels = {
                "hearing": "Audiência",
                "deadline": "Prazo",
                "petition": "Petição",
                "decision": "Decisão",
                "notification": "Notificação",
                "document": "Documento",
                "other": "Outro",
            }

            fee_type_labels = {
                "initial": "Honorários Iniciais",
                "success": "Êxito",
                "monthly": "Mensalidade",
                "hourly": "Por Hora",
                "hearing": "Audiência",
                "petition": "Petição",
                "other": "Outro",
            }

            note_type_labels = {
                "general": "Geral",
                "meeting": "Reunião",
                "phone_call": "Ligação",
                "research": "Pesquisa",
                "strategy": "Estratégia",
                "other": "Outro",
            }

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # UNION query to get all recent activities
                    await cur.execute(
                        """
                        SELECT
                            'timeline' as type,
                            title as description,
                            event_type as detail,
                            created_at as time
                        FROM office_api.timeline_events
                        WHERE user_id = %s

                        UNION ALL

                        SELECT
                            'note' as type,
                            title as description,
                            note_type as detail,
                            created_at as time
                        FROM office_api.notes
                        WHERE user_id = %s

                        UNION ALL

                        SELECT
                            'payment' as type,
                            'Pagamento recebido: R$ ' || amount::TEXT as description,
                            fee_type as detail,
                            paid_date::TIMESTAMPTZ as time
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'paid' AND paid_date IS NOT NULL

                        ORDER BY time DESC
                        LIMIT %s
                        """,
                        (user_id, user_id, user_id, limit),
                    )
                    rows = await cur.fetchall()

                    activities = []
                    for row in rows:
                        activity_type = row["type"]
                        detail = row["detail"]
                        time = row["time"]

                        # Format detail label based on type
                        if activity_type == "timeline":
                            detail_label = event_type_labels.get(
                                detail, detail.capitalize() if detail else "Evento"
                            )
                        elif activity_type == "note":
                            detail_label = note_type_labels.get(
                                detail, detail.capitalize() if detail else "Nota"
                            )
                        elif activity_type == "payment":
                            detail_label = fee_type_labels.get(
                                detail, detail.capitalize() if detail else "Pagamento"
                            )
                        else:
                            detail_label = detail.capitalize() if detail else ""

                        # Calculate relative time
                        time_relative = self._get_relative_time(time, now)

                        activities.append(
                            {
                                "type": activity_type,
                                "description": row["description"] or "",
                                "detail": detail_label,
                                "time": time.isoformat(),
                                "time_relative": time_relative,
                            }
                        )

                    return activities

        except Exception as e:
            logger.error(f"Failed to get recent activity: {e}")
            return []

    def _get_relative_time(self, past_time: datetime, now: datetime) -> str:
        """Convert datetime to Portuguese relative time string."""
        diff = now - past_time
        seconds = diff.total_seconds()

        if seconds < 60:
            return "há alguns segundos"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f"há {minutes} minuto{'s' if minutes != 1 else ''}"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            return f"há {hours} hora{'s' if hours != 1 else ''}"
        elif seconds < 172800:  # Less than 2 days
            if diff.days == 0:
                return "hoje"
            else:
                return "ontem"
        elif seconds < 604800:  # Less than 7 days
            days = diff.days
            return f"há {days} dia{'s' if days != 1 else ''}"
        elif seconds < 2592000:  # Less than 30 days
            weeks = int(diff.days / 7)
            return f"há {weeks} semana{'s' if weeks != 1 else ''}"
        elif seconds < 31536000:  # Less than 365 days
            months = int(diff.days / 30)
            return f"há {months} {'mês' if months == 1 else 'meses'}"
        else:
            years = int(diff.days / 365)
            return f"há {years} ano{'s' if years != 1 else ''}"


dashboard_service = DashboardService()
