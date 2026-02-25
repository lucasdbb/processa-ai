from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.deadlines.schemas import (
    DeadlineCreate,
    DeadlineListParams,
    DeadlineResponse,
    DeadlineUpdate,
)


class DeadlinesService:
    """Service for deadline operations.

    This service operates on the office_api.events table, filtering for event_type = 'prazo'.
    It provides a bridge layer so the existing deadlines API continues to work while the data
    lives in the unified events table.
    """

    async def list_deadlines(
        self,
        user_id: UUID,
        params: DeadlineListParams,
    ) -> tuple[list[DeadlineResponse], int]:
        """List deadlines for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s", "event_type = %s"]
        query_params: list[Any] = [str(user_id), "prazo"]

        if params.start_date:
            where_conditions.append("start_at::date >= %s")
            query_params.append(params.start_date)

        if params.end_date:
            where_conditions.append("start_at::date <= %s")
            query_params.append(params.end_date)

        if params.status:
            where_conditions.append("deadline_status = %s")
            query_params.append(params.status)

        if params.priority:
            where_conditions.append("priority = %s")
            query_params.append(params.priority)

        if params.process_id:
            where_conditions.append("processo_id = %s")
            query_params.append(str(params.process_id))

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.events WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT
                        id,
                        user_id,
                        processo_id as process_id,
                        title,
                        description,
                        start_at as due_date,
                        priority,
                        deadline_status as status,
                        completed_at,
                        reminder_days_before,
                        created_at,
                        updated_at
                    FROM office_api.events
                    WHERE {where_clause}
                    ORDER BY start_at ASC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                deadlines = [DeadlineResponse(**row) for row in rows]
                return deadlines, total

    async def get_deadline(self, user_id: UUID, deadline_id: UUID) -> DeadlineResponse | None:
        """Get a single deadline by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        id,
                        user_id,
                        processo_id as process_id,
                        title,
                        description,
                        start_at as due_date,
                        priority,
                        deadline_status as status,
                        completed_at,
                        reminder_days_before,
                        created_at,
                        updated_at
                    FROM office_api.events
                    WHERE user_id = %s AND id = %s AND event_type = %s
                    """,
                    (str(user_id), str(deadline_id), "prazo"),
                )
                row = await cur.fetchone()
                return DeadlineResponse(**row) if row else None

    async def create_deadline(self, user_id: UUID, data: DeadlineCreate) -> DeadlineResponse:
        """Create a new deadline."""
        pool = await get_pool()

        # Calculate end_at (1 hour after start)
        end_at = data.due_date + timedelta(hours=1)

        # Determine if all_day based on time component
        all_day = data.due_date.time() == datetime.min.time()

        # Calculate reminder_minutes based on reminder_days_before
        if data.reminder_days_before > 0:
            reminder_minutes = [data.reminder_days_before * 1440]  # days to minutes
        else:
            reminder_minutes = [15, 60]  # default reminders

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.events (
                        user_id,
                        evento_id,
                        processo_id,
                        title,
                        description,
                        start_at,
                        end_at,
                        all_day,
                        event_type,
                        status,
                        deadline_status,
                        priority,
                        reminder_days_before,
                        reminder_minutes,
                        color,
                        source,
                        sync_status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING
                        id,
                        user_id,
                        processo_id as process_id,
                        title,
                        description,
                        start_at as due_date,
                        priority,
                        deadline_status as status,
                        completed_at,
                        reminder_days_before,
                        created_at,
                        updated_at
                    """,
                    (
                        str(user_id),
                        None,  # evento_id (local event, no external ID)
                        str(data.process_id),
                        data.title,
                        data.description,
                        data.due_date,
                        end_at,
                        all_day,
                        "prazo",  # event_type
                        "confirmed",  # status (event status)
                        "pending",  # deadline_status (always starts as pending)
                        data.priority,
                        data.reminder_days_before,
                        reminder_minutes,
                        "#f59e0b",  # color (amber for deadlines)
                        "local",  # source
                        "pending_sync",  # sync_status
                    ),
                )
                row = await cur.fetchone()
                return DeadlineResponse(**row)

    async def update_deadline(
        self, user_id: UUID, deadline_id: UUID, data: DeadlineUpdate
    ) -> DeadlineResponse | None:
        """Update an existing deadline."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

        if not update_data:
            return await self.get_deadline(user_id, deadline_id)

        # Build SET clauses, mapping deadline fields to event fields
        set_clauses = []
        values = []

        if "title" in update_data:
            set_clauses.append("title = %s")
            values.append(update_data["title"])

        if "description" in update_data:
            set_clauses.append("description = %s")
            values.append(update_data["description"])

        if "due_date" in update_data:
            due_date = update_data["due_date"]
            set_clauses.append("start_at = %s")
            values.append(due_date)

            # Also update end_at
            end_at = due_date + timedelta(hours=1)
            set_clauses.append("end_at = %s")
            values.append(end_at)

            # Update all_day flag
            all_day = due_date.time() == datetime.min.time()
            set_clauses.append("all_day = %s")
            values.append(all_day)

        if "priority" in update_data:
            set_clauses.append("priority = %s")
            values.append(update_data["priority"])

        if "status" in update_data:
            set_clauses.append("deadline_status = %s")
            values.append(update_data["status"])

            # If marking as completed, set completed_at
            if update_data["status"] == "completed":
                set_clauses.append("completed_at = %s")
                values.append(datetime.utcnow())

        if "reminder_days_before" in update_data:
            reminder_days = update_data["reminder_days_before"]
            set_clauses.append("reminder_days_before = %s")
            values.append(reminder_days)

            # Also update reminder_minutes
            if reminder_days > 0:
                reminder_minutes = [reminder_days * 1440]
            else:
                reminder_minutes = [15, 60]
            set_clauses.append("reminder_minutes = %s")
            values.append(reminder_minutes)

        set_clause = ", ".join(set_clauses)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.events
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s AND event_type = %s
                    RETURNING
                        id,
                        user_id,
                        processo_id as process_id,
                        title,
                        description,
                        start_at as due_date,
                        priority,
                        deadline_status as status,
                        completed_at,
                        reminder_days_before,
                        created_at,
                        updated_at
                    """,
                    values + [str(user_id), str(deadline_id), "prazo"],
                )
                row = await cur.fetchone()
                return DeadlineResponse(**row) if row else None

    async def delete_deadline(self, user_id: UUID, deadline_id: UUID) -> bool:
        """Delete a deadline."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM office_api.events "
                    "WHERE user_id = %s AND id = %s AND event_type = %s",
                    (str(user_id), str(deadline_id), "prazo"),
                )
                return cur.rowcount > 0


deadlines_service = DeadlinesService()
