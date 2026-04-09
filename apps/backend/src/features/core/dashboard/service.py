from datetime import datetime, timedelta, timezone

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.core.logging import logger
from src.core.supabase import get_supabase


class DashboardService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_dashboard_stats(self, user_id: str) -> dict:
        """Get dashboard statistics for user in a single query (consistent snapshot)."""
        try:
            pool = await get_pool()

            first_day_of_month = datetime.now(timezone.utc).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            first_day_prev_month = (first_day_of_month - timedelta(days=1)).replace(day=1)
            today = datetime.now(timezone.utc).date()

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute(
                        """
                        SELECT
                            (SELECT COUNT(*) FROM office_api.clients
                             WHERE user_id = %(uid)s) as total_clients,
                            (SELECT COUNT(*) FROM office_api.clients
                             WHERE user_id = %(uid)s
                               AND created_at >= %(month_start)s) as new_clients_this_month,
                            (SELECT COUNT(*) FROM office_api.processes
                             WHERE user_id = %(uid)s
                               AND status != 'archived') as active_processes,
                            (SELECT COUNT(*) FROM office_api.processes
                             WHERE user_id = %(uid)s
                               AND created_at >= %(month_start)s) as new_processes_this_month,
                            (SELECT COUNT(*) FROM office_api.events
                             WHERE user_id = %(uid)s AND event_type = 'prazo'
                               AND deadline_status = 'pending'
                               AND start_at::date = %(today)s) as deadlines_today,
                            (SELECT COUNT(*) FROM office_api.events
                             WHERE user_id = %(uid)s AND event_type = 'prazo'
                               AND deadline_status = 'pending'
                               AND start_at::date = %(today)s
                               AND priority = 'high') as urgent_deadlines_today,
                            (SELECT COUNT(*) FROM office_api.events
                             WHERE user_id = %(uid)s
                               AND event_type = 'prazo') as total_deadlines,
                            (SELECT COUNT(*) FROM public.credit_transactions
                             WHERE user_id = %(uid)s AND transaction_type = 'consume'
                               AND reason LIKE %(calc_pattern)s
                               AND created_at >= %(month_start)s) as calculations_this_month,
                            (SELECT COUNT(*) FROM public.credit_transactions
                             WHERE user_id = %(uid)s AND transaction_type = 'consume'
                               AND reason LIKE %(calc_pattern)s
                               AND created_at >= %(prev_month_start)s
                               AND created_at < %(month_start)s) as prev_month_calculations,
                            (SELECT COUNT(*) FROM office_api.services
                             WHERE user_id = %(uid)s
                               AND status = 'active') as active_services
                        """,
                        {
                            "uid": user_id,
                            "month_start": first_day_of_month,
                            "prev_month_start": first_day_prev_month,
                            "today": today,
                            "calc_pattern": "%calculation%",
                        },
                    )
                    row = await cur.fetchone()

                    curr = row["calculations_this_month"]
                    prev = row["prev_month_calculations"]
                    if prev > 0:
                        change_pct = round((curr - prev) / prev * 100, 1)
                    else:
                        change_pct = 100 if curr > 0 else 0

                    return {
                        "total_clients": row["total_clients"],
                        "new_clients_this_month": row["new_clients_this_month"],
                        "active_processes": row["active_processes"],
                        "new_processes_this_month": row["new_processes_this_month"],
                        "deadlines_today": row["deadlines_today"],
                        "urgent_deadlines_today": row["urgent_deadlines_today"],
                        "total_deadlines": row["total_deadlines"],
                        "calculations_this_month": curr,
                        "calculations_change_percent": change_pct,
                        "active_services": row["active_services"],
                    }

        except Exception as e:
            logger.error(f"Failed to get dashboard stats: {e}")
            return {
                "total_clients": 0,
                "new_clients_this_month": 0,
                "active_processes": 0,
                "new_processes_this_month": 0,
                "deadlines_today": 0,
                "urgent_deadlines_today": 0,
                "calculations_this_month": 0,
                "calculations_change_percent": 0,
                "active_services": 0,
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
                                                WHERE e.user_id = %s
                                                AND e.event_type = 'prazo'
                                                AND e.deadline_status = 'pending'
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

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Totals and aging in a single aggregate query.
                    await cur.execute(
                        """
                        SELECT
                            COALESCE(SUM(amount), 0) AS total_fees,
                            COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0) AS total_received,
                            COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) AS total_pending,
                            COALESCE(SUM(amount) FILTER (WHERE status = 'overdue'), 0) AS total_overdue,
                            COALESCE(
                                SUM(amount) FILTER (
                                    WHERE status = 'overdue'
                                      AND due_date IS NOT NULL
                                      AND (CURRENT_DATE - due_date) <= 30
                                ),
                                0
                            ) AS aging_0_30,
                            COALESCE(
                                SUM(amount) FILTER (
                                    WHERE status = 'overdue'
                                      AND due_date IS NOT NULL
                                      AND (CURRENT_DATE - due_date) BETWEEN 31 AND 60
                                ),
                                0
                            ) AS aging_31_60,
                            COALESCE(
                                SUM(amount) FILTER (
                                    WHERE status = 'overdue'
                                      AND due_date IS NOT NULL
                                      AND (CURRENT_DATE - due_date) BETWEEN 61 AND 90
                                ),
                                0
                            ) AS aging_61_90,
                            COALESCE(
                                SUM(amount) FILTER (
                                    WHERE status = 'overdue'
                                      AND due_date IS NOT NULL
                                      AND (CURRENT_DATE - due_date) > 90
                                ),
                                0
                            ) AS aging_90_plus
                        FROM office_api.fees
                        WHERE user_id = %s
                        """,
                        (user_id,),
                    )
                    totals = await cur.fetchone() or {}

                    total_fees = float(totals.get("total_fees", 0.0))
                    total_received = float(totals.get("total_received", 0.0))
                    total_pending = float(totals.get("total_pending", 0.0))
                    total_overdue = float(totals.get("total_overdue", 0.0))

                    aging = {
                        "0_30": float(totals.get("aging_0_30", 0.0)),
                        "31_60": float(totals.get("aging_31_60", 0.0)),
                        "61_90": float(totals.get("aging_61_90", 0.0)),
                        "90_plus": float(totals.get("aging_90_plus", 0.0)),
                    }

                    # Last 6 months revenue using generated months + grouped fee aggregates.
                    await cur.execute(
                        """
                        WITH months AS (
                            SELECT
                                (date_trunc('month', CURRENT_DATE) - (interval '1 month' * gs.n))::date AS month_start
                            FROM generate_series(5, 0, -1) AS gs(n)
                        ),
                        paid AS (
                            SELECT
                                date_trunc('month', paid_date)::date AS month_start,
                                COALESCE(SUM(amount), 0) AS received
                            FROM office_api.fees
                            WHERE user_id = %s
                              AND status = 'paid'
                              AND paid_date IS NOT NULL
                              AND paid_date >= (date_trunc('month', CURRENT_DATE) - interval '5 month')::date
                            GROUP BY 1
                        ),
                        pending AS (
                            SELECT
                                date_trunc('month', due_date)::date AS month_start,
                                COALESCE(SUM(amount), 0) AS pending
                            FROM office_api.fees
                            WHERE user_id = %s
                              AND status IN ('pending', 'overdue')
                              AND due_date IS NOT NULL
                              AND due_date >= (date_trunc('month', CURRENT_DATE) - interval '5 month')::date
                            GROUP BY 1
                        )
                        SELECT
                            to_char(m.month_start, 'YYYY-MM') AS month,
                            COALESCE(p.received, 0) AS received,
                            COALESCE(pe.pending, 0) AS pending
                        FROM months m
                        LEFT JOIN paid p ON p.month_start = m.month_start
                        LEFT JOIN pending pe ON pe.month_start = m.month_start
                        ORDER BY m.month_start
                        """,
                        (user_id, user_id),
                    )
                    monthly_rows = await cur.fetchall()
                    monthly_revenue = [
                        {
                            "month": row["month"],
                            "received": float(row["received"]),
                            "pending": float(row["pending"]),
                        }
                        for row in monthly_rows
                    ]

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

    async def get_daily_briefing(self, user_id: str) -> dict:
        """Get daily briefing summary (deadlines, events, overdue fees)."""
        try:
            pool = await get_pool()
            now = datetime.now(timezone.utc)
            today = now.date()

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Get user name
                    await cur.execute(
                        "SELECT name FROM public.profiles WHERE id = %s",
                        (user_id,),
                    )
                    profile = await cur.fetchone()
                    user_name = profile["name"] if profile else ""

                    # Get today's deadlines (prazos)
                    await cur.execute(
                        """
                        SELECT e.id, e.title, e.priority,
                               p.process_number, c.name as client_name
                        FROM office_api.events e
                        LEFT JOIN office_api.processes p ON e.processo_id = p.id
                        LEFT JOIN office_api.clients c ON p.client_id = c.id
                        WHERE e.user_id = %s
                          AND e.event_type = 'prazo'
                          AND e.deadline_status = 'pending'
                          AND e.start_at::date = %s
                        ORDER BY e.priority DESC, e.start_at ASC
                        """,
                        (user_id, today),
                    )
                    deadlines_rows = await cur.fetchall()

                    deadlines_today = [
                        {
                            "id": str(row["id"]),
                            "title": row["title"] or "",
                            "process": row["process_number"] or "N/A",
                            "client": row["client_name"] or "N/A",
                            "priority": row["priority"] or "medium",
                            "urgent": row["priority"] in ("high", "urgent"),
                        }
                        for row in deadlines_rows
                    ]

                    # Get today's calendar events (non-deadline)
                    await cur.execute(
                        """
                        SELECT e.id, e.title, e.start_at, e.event_type,
                               p.process_number, c.name as client_name
                        FROM office_api.events e
                        LEFT JOIN office_api.processes p ON e.processo_id = p.id
                        LEFT JOIN office_api.clients c ON p.client_id = c.id
                        WHERE e.user_id = %s
                          AND e.event_type != 'prazo'
                          AND e.status != 'cancelled'
                          AND e.start_at::date = %s
                        ORDER BY e.start_at ASC
                        """,
                        (user_id, today),
                    )
                    events_rows = await cur.fetchall()

                    event_type_labels = {
                        "audiencia": "Audiência",
                        "reuniao": "Reunião",
                        "other": "Evento",
                    }

                    events_today = [
                        {
                            "id": str(row["id"]),
                            "title": row["title"] or "",
                            "start_at": row["start_at"].isoformat() if row["start_at"] else None,
                            "event_type": row["event_type"],
                            "event_type_label": event_type_labels.get(row["event_type"], "Evento"),
                            "process": row["process_number"] or "N/A",
                            "client": row["client_name"] or "N/A",
                        }
                        for row in events_rows
                    ]

                    # Get overdue fees (top 5)
                    await cur.execute(
                        """
                        SELECT f.id, f.description, f.amount, f.due_date,
                               c.name as client_name
                        FROM office_api.fees f
                        LEFT JOIN office_api.clients c ON f.client_id = c.id
                        WHERE f.user_id = %s AND f.status = 'overdue'
                        ORDER BY f.due_date ASC
                        LIMIT 5
                        """,
                        (user_id,),
                    )
                    overdue_rows = await cur.fetchall()

                    overdue_fees = [
                        {
                            "id": str(row["id"]),
                            "description": row["description"] or "",
                            "amount": float(row["amount"]),
                            "due_date": row["due_date"].isoformat() if row["due_date"] else None,
                            "client_name": row["client_name"] or "N/A",
                            "days_overdue": (today - row["due_date"]).days
                            if row["due_date"]
                            else 0,
                        }
                        for row in overdue_rows
                    ]

                    # Get total overdue count
                    await cur.execute(
                        """
                        SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount
                        FROM office_api.fees
                        WHERE user_id = %s AND status = 'overdue'
                        """,
                        (user_id,),
                    )
                    overdue_totals = await cur.fetchone()

            return {
                "user_name": user_name,
                "today_date": today.isoformat(),
                "deadlines_today": deadlines_today,
                "events_today": events_today,
                "overdue_fees": overdue_fees,
                "summary": {
                    "deadlines_count": len(deadlines_today),
                    "urgent_deadlines_count": sum(1 for d in deadlines_today if d["urgent"]),
                    "events_count": len(events_today),
                    "overdue_fees_count": overdue_totals["total"] if overdue_totals else 0,
                    "overdue_fees_total": float(overdue_totals["total_amount"])
                    if overdue_totals
                    else 0.0,
                },
            }

        except Exception as e:
            logger.error(f"Failed to get daily briefing: {e}")
            return {
                "user_name": "",
                "today_date": datetime.now(timezone.utc).date().isoformat(),
                "deadlines_today": [],
                "events_today": [],
                "overdue_fees": [],
                "summary": {
                    "deadlines_count": 0,
                    "urgent_deadlines_count": 0,
                    "events_count": 0,
                    "overdue_fees_count": 0,
                    "overdue_fees_total": 0.0,
                },
            }

    async def get_tools_catalog(self) -> dict:
        """Get AI tools and calculators in a single query."""
        try:
            pool = await get_pool()

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    await cur.execute("""
                        SELECT
                            (SELECT COALESCE(json_agg(sub ORDER BY sub.display_order, sub.display_name), '[]'::json)
                             FROM (
                                SELECT key as slug, display_name as name,
                                       COALESCE(description, '') as description,
                                       COALESCE(icon, 'FileText') as icon,
                                       COALESCE(variant, 'prompt') as variant,
                                       is_locked as locked,
                                       COALESCE(display_order, 0) as "order",
                                       display_order, display_name
                                FROM public.ai_endpoints
                             ) sub
                            ) as ai_tools,
                            (SELECT COALESCE(json_agg(sub ORDER BY sub.display_order, sub.display_name), '[]'::json)
                             FROM (
                                SELECT key as slug, display_name as name,
                                       COALESCE(description, '') as description,
                                       COALESCE(icon, 'Calculator') as icon,
                                       path,
                                       is_locked as locked,
                                       COALESCE(display_order, 0) as "order",
                                       display_order, display_name
                                FROM public.calculators
                             ) sub
                            ) as calculators
                    """)
                    row = await cur.fetchone()

                    return {
                        "ai_tools": row["ai_tools"],
                        "calculators": row["calculators"],
                    }

        except Exception as e:
            logger.error(f"Failed to get tools catalog: {e}")
            return {"ai_tools": [], "calculators": []}

    async def get_ai_cost_stats(self) -> dict:
        """Get AI token usage and cost statistics (admin only)."""
        try:
            pool = await get_pool()

            now = datetime.now(timezone.utc)
            thirty_days_ago = now - timedelta(days=30)

            async with pool.connection() as conn:
                async with conn.cursor(row_factory=dict_row) as cur:
                    # Totals (all time)
                    await cur.execute(
                        """
                        SELECT
                            COUNT(*) as total_jobs,
                            COALESCE(SUM((result_payload->'token_usage'->>'prompt_tokens')::int), 0) as total_prompt,
                            COALESCE(SUM((result_payload->'token_usage'->>'completion_tokens')::int), 0) as total_completion,
                            COALESCE(SUM((result_payload->'token_usage'->>'total_tokens')::int), 0) as total_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'cost_usd')::numeric), 0) as total_cost
                                                FROM public.jobs
                        WHERE status = 'completed'
                          AND result_payload->'token_usage' IS NOT NULL
                        """
                    )
                    all_time = await cur.fetchone()

                    # Totals (last 30 days)
                    await cur.execute(
                        """
                        SELECT
                            COUNT(*) as total_jobs,
                            COALESCE(SUM((result_payload->'token_usage'->>'prompt_tokens')::int), 0) as total_prompt,
                            COALESCE(SUM((result_payload->'token_usage'->>'completion_tokens')::int), 0) as total_completion,
                            COALESCE(SUM((result_payload->'token_usage'->>'total_tokens')::int), 0) as total_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'cost_usd')::numeric), 0) as total_cost
                                                FROM public.jobs
                        WHERE status = 'completed'
                          AND result_payload->'token_usage' IS NOT NULL
                          AND finished_at >= %s
                        """,
                        (thirty_days_ago,),
                    )
                    last_30d = await cur.fetchone()

                    # Breakdown by model
                    await cur.execute(
                        """
                        SELECT
                            result_payload->'token_usage'->>'model' as model,
                            result_payload->'token_usage'->>'provider' as provider,
                            COUNT(*) as job_count,
                            COALESCE(SUM((result_payload->'token_usage'->>'prompt_tokens')::int), 0) as prompt_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'completion_tokens')::int), 0) as completion_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'total_tokens')::int), 0) as total_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'cost_usd')::numeric), 0) as total_cost
                                                FROM public.jobs
                        WHERE status = 'completed'
                          AND result_payload->'token_usage' IS NOT NULL
                        GROUP BY
                            result_payload->'token_usage'->>'model',
                            result_payload->'token_usage'->>'provider'
                        ORDER BY total_cost DESC
                        """
                    )
                    by_model = [dict(row) for row in await cur.fetchall()]

                    # Breakdown by endpoint (tool)
                    await cur.execute(
                        """
                        SELECT
                                                        job_type as endpoint_key,
                            COUNT(*) as job_count,
                            COALESCE(SUM((result_payload->'token_usage'->>'prompt_tokens')::int), 0) as prompt_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'completion_tokens')::int), 0) as completion_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'total_tokens')::int), 0) as total_tokens,
                            COALESCE(SUM((result_payload->'token_usage'->>'cost_usd')::numeric), 0) as total_cost
                                                FROM public.jobs
                        WHERE status = 'completed'
                          AND result_payload->'token_usage' IS NOT NULL
                                                GROUP BY job_type
                        ORDER BY total_cost DESC
                        """
                    )
                    by_endpoint = [dict(row) for row in await cur.fetchall()]

                    # Daily cost trend (last 30 days)
                    await cur.execute(
                        """
                        SELECT
                            finished_at::date as day,
                            COUNT(*) as job_count,
                            COALESCE(SUM((result_payload->'token_usage'->>'cost_usd')::numeric), 0) as daily_cost
                                                FROM public.jobs
                        WHERE status = 'completed'
                          AND result_payload->'token_usage' IS NOT NULL
                          AND finished_at >= %s
                        GROUP BY finished_at::date
                        ORDER BY day ASC
                        """,
                        (thirty_days_ago,),
                    )
                    daily_rows = await cur.fetchall()
                    daily_trend = [
                        {
                            "day": row["day"].isoformat(),
                            "job_count": row["job_count"],
                            "cost_usd": float(row["daily_cost"]),
                        }
                        for row in daily_rows
                    ]

            return {
                "all_time": {
                    "total_jobs": all_time["total_jobs"] if all_time else 0,
                    "prompt_tokens": all_time["total_prompt"] if all_time else 0,
                    "completion_tokens": all_time["total_completion"] if all_time else 0,
                    "total_tokens": all_time["total_tokens"] if all_time else 0,
                    "cost_usd": float(all_time["total_cost"]) if all_time else 0.0,
                },
                "last_30d": {
                    "total_jobs": last_30d["total_jobs"] if last_30d else 0,
                    "prompt_tokens": last_30d["total_prompt"] if last_30d else 0,
                    "completion_tokens": last_30d["total_completion"] if last_30d else 0,
                    "total_tokens": last_30d["total_tokens"] if last_30d else 0,
                    "cost_usd": float(last_30d["total_cost"]) if last_30d else 0.0,
                },
                "by_model": [
                    {
                        "model": row["model"] or "unknown",
                        "provider": row["provider"] or "unknown",
                        "job_count": row["job_count"],
                        "prompt_tokens": row["prompt_tokens"],
                        "completion_tokens": row["completion_tokens"],
                        "total_tokens": row["total_tokens"],
                        "cost_usd": float(row["total_cost"]),
                    }
                    for row in by_model
                ],
                "by_endpoint": [
                    {
                        "endpoint_key": row["endpoint_key"],
                        "job_count": row["job_count"],
                        "prompt_tokens": row["prompt_tokens"],
                        "completion_tokens": row["completion_tokens"],
                        "total_tokens": row["total_tokens"],
                        "cost_usd": float(row["total_cost"]),
                    }
                    for row in by_endpoint
                ],
                "daily_trend": daily_trend,
            }

        except Exception as e:
            logger.error(f"Failed to get AI cost stats: {e}")
            return {
                "all_time": {
                    "total_jobs": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "cost_usd": 0.0,
                },
                "last_30d": {
                    "total_jobs": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "cost_usd": 0.0,
                },
                "by_model": [],
                "by_endpoint": [],
                "daily_trend": [],
            }


dashboard_service = DashboardService()
