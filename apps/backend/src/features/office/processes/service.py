from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.processes.schemas import (
    ProcessClientInfo,
    ProcessCreate,
    ProcessDeadlineSummary,
    ProcessDetailResponse,
    ProcessDocumentSummary,
    ProcessListParams,
    ProcessResponse,
    ProcessTimelineEvent,
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

        where_conditions = ["p.user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.search:
            where_conditions.append(
                "(p.process_number ILIKE %s OR p.type ILIKE %s OR "
                "p.defendant ILIKE %s OR p.subject ILIKE %s)"
            )
            search_pattern = f"%{params.search}%"
            query_params.extend([search_pattern] * 4)

        if params.status:
            where_conditions.append("p.status = %s")
            query_params.append(params.status)

        if params.client_id:
            where_conditions.append("p.client_id = %s")
            query_params.append(str(params.client_id))

        if params.court:
            where_conditions.append("p.court = %s")
            query_params.append(params.court)

        if params.tribunal:
            where_conditions.append("p.tribunal = %s")
            query_params.append(params.tribunal)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.processes p WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT p.*, c.name as client_name
                    FROM office_api.processes p
                    LEFT JOIN office_api.clients c ON p.client_id = c.id
                    WHERE {where_clause}
                    ORDER BY p.created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                processes = [ProcessResponse(**row) for row in rows]
                return processes, total

    async def count_processes(self, user_id: UUID) -> dict[str, int]:
        """Count active processes for a user."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT COUNT(*) as total
                    FROM office_api.processes
                    WHERE user_id = %s AND status = 'active'
                    """,
                    (str(user_id),),
                )
                row = await cur.fetchone()
                return {"total": row["total"] if row else 0}

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
                        user_id, client_id, process_number, court, tribunal, defendant, type, area,
                        subject, value, status, notes, start_date
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active', %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.client_id),
                        data.process_number,
                        data.court,
                        data.tribunal,
                        data.defendant,
                        data.type,
                        data.area,
                        data.subject,
                        data.value,
                        data.notes,
                        data.start_date,
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

    async def get_process_detail(
        self, user_id: UUID, process_id: UUID
    ) -> ProcessDetailResponse | None:
        """Get aggregated process detail with client, deadlines, timeline, and documents."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get process basic info
                await cur.execute(
                    "SELECT * FROM office_api.processes WHERE user_id = %s AND id = %s",
                    (str(user_id), str(process_id)),
                )
                process_row = await cur.fetchone()

                if not process_row:
                    return None

                # Get client info
                await cur.execute(
                    """
                    SELECT id, name, email, phone, cpf_cnpj
                    FROM office_api.clients
                    WHERE id = %s AND user_id = %s
                    """,
                    (str(process_row["client_id"]), str(user_id)),
                )
                client_row = await cur.fetchone()
                client = (
                    ProcessClientInfo(**client_row)
                    if client_row
                    else ProcessClientInfo(
                        id=process_row["client_id"],
                        name="Cliente não encontrado",
                        email=None,
                        phone=None,
                        cpf_cnpj=None,
                    )
                )

                # Get deadlines with days_until calculation
                await cur.execute(
                    """
                    SELECT
                        id,
                        title,
                        start_at::text as due_date,
                        deadline_status as status,
                        priority,
                        (start_at::date - CURRENT_DATE) as days_until
                    FROM office_api.events
                    WHERE user_id = %s AND processo_id = %s AND event_type = 'prazo'
                    ORDER BY start_at ASC
                    LIMIT 10
                    """,
                    (str(user_id), str(process_id)),
                )
                deadline_rows = await cur.fetchall()
                deadlines = [ProcessDeadlineSummary(**row) for row in deadline_rows]

                # Get deadline counts
                await cur.execute(
                    """
                    SELECT
                        COUNT(*) as total,
                        COUNT(*) FILTER (
                            WHERE start_at < CURRENT_DATE
                            AND deadline_status != 'completed'
                        ) as overdue
                    FROM office_api.events
                    WHERE user_id = %s AND processo_id = %s AND event_type = 'prazo'
                    """,
                    (str(user_id), str(process_id)),
                )
                deadline_counts = await cur.fetchone()
                deadlines_count = deadline_counts["total"] if deadline_counts else 0
                overdue_deadlines_count = deadline_counts["overdue"] if deadline_counts else 0

                # Get timeline events
                await cur.execute(
                    """
                    SELECT id, event_type, title, description, event_date, created_at
                    FROM office_api.timeline_events
                    WHERE user_id = %s AND process_id = %s
                    ORDER BY event_date DESC, created_at DESC
                    LIMIT 20
                    """,
                    (str(user_id), str(process_id)),
                )
                timeline_rows = await cur.fetchall()
                timeline = [ProcessTimelineEvent(**row) for row in timeline_rows]

                # Get timeline count
                await cur.execute(
                    """
                    SELECT COUNT(*) as count
                    FROM office_api.timeline_events
                    WHERE user_id = %s AND process_id = %s
                    """,
                    (str(user_id), str(process_id)),
                )
                timeline_count_row = await cur.fetchone()
                timeline_count = timeline_count_row["count"] if timeline_count_row else 0

                # Get documents
                await cur.execute(
                    """
                    SELECT id, name, mime_type, file_size, file_url, created_at
                    FROM office_api.documents
                    WHERE user_id = %s AND process_id = %s
                    ORDER BY created_at DESC
                    LIMIT 10
                    """,
                    (str(user_id), str(process_id)),
                )
                document_rows = await cur.fetchall()
                documents = [ProcessDocumentSummary(**row) for row in document_rows]

                # Get documents count
                await cur.execute(
                    """
                    SELECT COUNT(*) as count
                    FROM office_api.documents
                    WHERE user_id = %s AND process_id = %s
                    """,
                    (str(user_id), str(process_id)),
                )
                documents_count_row = await cur.fetchone()
                documents_count = documents_count_row["count"] if documents_count_row else 0

                return ProcessDetailResponse(
                    **process_row,
                    client=client,
                    deadlines=deadlines,
                    deadlines_count=deadlines_count,
                    overdue_deadlines_count=overdue_deadlines_count,
                    timeline=timeline,
                    timeline_count=timeline_count,
                    documents=documents,
                    documents_count=documents_count,
                )


processes_service = ProcessesService()
