from src.core.supabase import get_supabase
from src.core.logging import logger
from datetime import datetime, timedelta, timezone


class DashboardService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_dashboard_stats(self, user_id: str) -> dict:
        """Get dashboard statistics for user."""
        try:
            stats = {}

            # Get clients count
            clients_result = (
                self.supabase.table("clients")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            )
            stats["total_clients"] = clients_result.count or 0

            # Get new clients this month
            first_day_of_month = datetime.now(timezone.utc).replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            new_clients_result = (
                self.supabase.table("clients")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .gte("created_at", first_day_of_month.isoformat())
                .execute()
            )
            stats["new_clients_this_month"] = new_clients_result.count or 0

            # Get active processes count
            processes_result = (
                self.supabase.table("processes")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .neq("status", "archived")
                .execute()
            )
            stats["active_processes"] = processes_result.count or 0

            # Get new processes this month
            new_processes_result = (
                self.supabase.table("processes")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .gte("created_at", first_day_of_month.isoformat())
                .execute()
            )
            stats["new_processes_this_month"] = new_processes_result.count or 0

            # Get deadlines for today
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            today_end = today_start + timedelta(days=1)
            
            deadlines_today_result = (
                self.supabase.table("deadlines")
                .select("id,priority", count="exact")
                .eq("user_id", user_id)
                .gte("due_date", today_start.isoformat())
                .lt("due_date", today_end.isoformat())
                .execute()
            )
            stats["deadlines_today"] = deadlines_today_result.count or 0
            
            # Count urgent deadlines (high priority)
            urgent_deadlines = 0
            if deadlines_today_result.data:
                urgent_deadlines = sum(
                    1 for d in deadlines_today_result.data if d.get("priority") == "high"
                )
            stats["urgent_deadlines_today"] = urgent_deadlines

            # Get calculations count this month (from credit transactions)
            calculations_result = (
                self.supabase.table("credit_transactions")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("transaction_type", "consume")
                .like("reason", "%calculation%")
                .gte("created_at", first_day_of_month.isoformat())
                .execute()
            )
            stats["calculations_this_month"] = calculations_result.count or 0

            # Get previous month calculations for comparison
            first_day_prev_month = (first_day_of_month - timedelta(days=1)).replace(day=1)
            prev_calculations_result = (
                self.supabase.table("credit_transactions")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("transaction_type", "consume")
                .like("reason", "%calculation%")
                .gte("created_at", first_day_prev_month.isoformat())
                .lt("created_at", first_day_of_month.isoformat())
                .execute()
            )
            prev_month_calculations = prev_calculations_result.count or 0
            
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
            now = datetime.now(timezone.utc)
            result = (
                self.supabase.table("deadlines")
                .select("*,processes(number,client_id),clients(name)")
                .eq("user_id", user_id)
                .gte("due_date", now.isoformat())
                .order("due_date", desc=False)
                .limit(limit)
                .execute()
            )

            deadlines = []
            for deadline in result.data or []:
                due_date = datetime.fromisoformat(deadline["due_date"].replace("Z", "+00:00"))
                days_left = (due_date - now).days
                
                deadlines.append({
                    "id": deadline["id"],
                    "type": deadline.get("type", "Prazo"),
                    "title": deadline.get("title", ""),
                    "process": deadline.get("processes", {}).get("number", "N/A"),
                    "client": deadline.get("clients", {}).get("name", "N/A"),
                    "days_left": days_left,
                    "urgent": deadline.get("priority") == "high" or days_left <= 1,
                    "due_date": deadline["due_date"],
                })

            return deadlines

        except Exception as e:
            logger.error(f"Failed to get upcoming deadlines: {e}")
            return []


dashboard_service = DashboardService()
