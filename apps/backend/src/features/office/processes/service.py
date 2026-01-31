from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.processes.schemas import (
    ProcessCreate,
    ProcessListParams,
    ProcessResponse,
    ProcessUpdate,
)


class ProcessesService:
    """Service for process operations."""

    async def list_processes(
        self,
        user_id: UUID,
        params: ProcessListParams,
    ) -> tuple[list[ProcessResponse], int]:
        """List processes for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.search:
            where_conditions.append(
                "(process_number ILIKE %s OR type ILIKE %s OR "
                "defendant ILIKE %s OR subject ILIKE %s)"
            )
            search_pattern = f"%{params.search}%"
            query_params.extend([search_pattern] * 4)

        if params.status:
            where_conditions.append("status = %s")
            query_params.append(params.status)

        if params.client_id:
            where_conditions.append("client_id = %s")
            query_params.append(str(params.client_id))

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.processes WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT * FROM office_api.processes
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                processes = [ProcessResponse(**row) for row in rows]
                return processes, total

    async def get_process(self, user_id: UUID, process_id: UUID) -> ProcessResponse | None:
        """Get a single process by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM office_api.processes WHERE user_id = %s AND id = %s",
                    (str(user_id), str(process_id)),
                )
                row = await cur.fetchone()
                return ProcessResponse(**row) if row else None

    async def create_process(self, user_id: UUID, data: ProcessCreate) -> ProcessResponse:
        """Create a new process."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.processes (
                        user_id, client_id, process_number, court, defendant, type,
                        subject, value, status, notes, start_date, end_date
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.client_id),
                        data.process_number,
                        data.court,
                        data.defendant,
                        data.type,
                        data.subject,
                        data.value,
                        data.status or "active",
                        data.notes,
                        data.start_date,
                        data.end_date,
                    ),
                )
                row = await cur.fetchone()
                return ProcessResponse(**row)

    async def update_process(
        self, user_id: UUID, process_id: UUID, data: ProcessUpdate
    ) -> ProcessResponse | None:
        """Update an existing process."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_process(user_id, process_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.processes
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(process_id)],
                )
                row = await cur.fetchone()
                return ProcessResponse(**row) if row else None

    async def delete_process(self, user_id: UUID, process_id: UUID) -> bool:
        """Delete a process."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM office_api.processes WHERE user_id = %s AND id = %s",
                    (str(user_id), str(process_id)),
                )
                return cur.rowcount > 0


processes_service = ProcessesService()
