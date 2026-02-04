from datetime import datetime
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
    """Service for deadline operations."""

    async def list_deadlines(
        self,
        user_id: UUID,
        params: DeadlineListParams,
    ) -> tuple[list[DeadlineResponse], int]:
        """List deadlines for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.start_date:
            where_conditions.append("due_date >= %s")
            query_params.append(params.start_date)

        if params.end_date:
            where_conditions.append("due_date <= %s")
            query_params.append(params.end_date)

        if params.status:
            where_conditions.append("status = %s")
            query_params.append(params.status)

        if params.priority:
            where_conditions.append("priority = %s")
            query_params.append(params.priority)

        if params.process_id:
            where_conditions.append("process_id = %s")
            query_params.append(str(params.process_id))

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.deadlines WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT * FROM office_api.deadlines
                    WHERE {where_clause}
                    ORDER BY due_date ASC
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
                    "SELECT * FROM office_api.deadlines WHERE user_id = %s AND id = %s",
                    (str(user_id), str(deadline_id)),
                )
                row = await cur.fetchone()
                return DeadlineResponse(**row) if row else None

    async def create_deadline(self, user_id: UUID, data: DeadlineCreate) -> DeadlineResponse:
        """Create a new deadline."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.deadlines (
                        user_id, process_id, title, description, due_date,
                        priority, status, reminder_days_before
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.process_id),
                        data.title,
                        data.description,
                        data.due_date,
                        data.priority,
                        "pending",  # Status always starts as pending
                        data.reminder_days_before,
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

        if update_data.get("status") == "completed" and "completed_at" not in update_data:
            update_data["completed_at"] = datetime.utcnow()

        if not update_data:
            return await self.get_deadline(user_id, deadline_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.deadlines
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(deadline_id)],
                )
                row = await cur.fetchone()
                return DeadlineResponse(**row) if row else None

    async def delete_deadline(self, user_id: UUID, deadline_id: UUID) -> bool:
        """Delete a deadline."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM office_api.deadlines WHERE user_id = %s AND id = %s",
                    (str(user_id), str(deadline_id)),
                )
                return cur.rowcount > 0


deadlines_service = DeadlinesService()
