from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.clients.schemas import (
    ClientCreate,
    ClientDetailResponse,
    ClientFeeSummary,
    ClientListParams,
    ClientNoteSummary,
    ClientProcessSummary,
    ClientResponse,
    ClientServiceSummary,
    ClientUpdate,
)


class ClientsService:
    """Service for client operations."""

    async def list_clients(
        self,
        user_id: UUID,
        params: ClientListParams,
    ) -> tuple[list[ClientResponse], int]:
        """List clients for a user."""
        pool = await get_pool()

        # Build WHERE conditions
        where_conditions = ["user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        # Add search filter
        if params.search:
            where_conditions.append("(name ILIKE %s OR email ILIKE %s OR cpf_cnpj ILIKE %s)")
            search_pattern = f"%{params.search}%"
            query_params.extend([search_pattern, search_pattern, search_pattern])

        # Add status filter
        if params.status:
            where_conditions.append("status = %s")
            query_params.append(params.status)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get total count
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM office_api.clients
                    WHERE {where_clause}
                """
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                # Get paginated results
                data_query = f"""
                    SELECT *
                    FROM office_api.clients
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                clients = [ClientResponse(**row) for row in rows]
                return clients, total

    async def get_client(self, user_id: UUID, client_id: UUID) -> ClientResponse | None:
        """Get a single client by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT * FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                row = await cur.fetchone()

                if not row:
                    return None

                return ClientResponse(**row)

    async def create_client(self, user_id: UUID, data: ClientCreate) -> ClientResponse:
        """Create a new client."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.clients (
                        user_id, name, email, phone, cpf_cnpj, address,
                        city, state, zip_code, notes, status
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        data.name,
                        data.email,
                        data.phone,
                        data.cpf_cnpj,
                        data.address,
                        data.city,
                        data.state,
                        data.zip_code,
                        data.notes,
                        "active",
                    ),
                )
                row = await cur.fetchone()
                return ClientResponse(**row)

    async def update_client(
        self, user_id: UUID, client_id: UUID, data: ClientUpdate
    ) -> ClientResponse | None:
        """Update an existing client."""
        pool = await get_pool()

        # Filter out None values
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}

        if not update_data:
            return await self.get_client(user_id, client_id)

        # Build SET clause dynamically
        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.clients
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(client_id)],
                )
                row = await cur.fetchone()

                if not row:
                    return None

                return ClientResponse(**row)

    async def delete_client(self, user_id: UUID, client_id: UUID) -> bool:
        """Delete a client."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    DELETE FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                return cur.rowcount > 0

    async def get_client_detail(
        self, user_id: UUID, client_id: UUID
    ) -> ClientDetailResponse | None:
        """Get aggregated client detail with processes, fees, and notes."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get client basic info
                await cur.execute(
                    """
                    SELECT * FROM office_api.clients
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                client_row = await cur.fetchone()

                if not client_row:
                    return None

                # Get processes with next deadline
                await cur.execute(
                    """
                    SELECT
                        p.id,
                        p.process_number as number,
                        p.type,
                        p.status,
                        p.court,
                        p.value,
                        (
                            SELECT MIN(e.start_at)::text
                            FROM office_api.events e
                            WHERE e.processo_id = p.id AND e.event_type = 'prazo'
                              AND e.start_at >= CURRENT_DATE
                              AND e.deadline_status != 'completed'
                        ) as next_deadline
                    FROM office_api.processes p
                    WHERE p.user_id = %s AND p.client_id = %s
                    ORDER BY p.created_at DESC
                    """,
                    (str(user_id), str(client_id)),
                )
                process_rows = await cur.fetchall()
                processes = [
                    ClientProcessSummary(
                        id=row["id"],
                        number=row["number"],
                        type=row["type"],
                        status=row["status"],
                        court=row["court"],
                        value=float(row["value"]) if row["value"] else None,
                        next_deadline=row["next_deadline"],
                    )
                    for row in process_rows
                ]

                # Get fees summary
                await cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(amount), 0) as total_amount,
                        COALESCE(SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END), 0) as total_paid,
                        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as total_pending,
                        COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount - COALESCE(paid_amount, 0) ELSE 0 END), 0) as total_overdue,
                        COUNT(*) as fees_count
                    FROM office_api.fees
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                fees_row = await cur.fetchone()
                fees_summary = ClientFeeSummary(
                    total_amount=float(fees_row["total_amount"]) if fees_row else 0,
                    total_paid=float(fees_row["total_paid"]) if fees_row else 0,
                    total_pending=float(fees_row["total_pending"]) if fees_row else 0,
                    total_overdue=float(fees_row["total_overdue"]) if fees_row else 0,
                    fees_count=fees_row["fees_count"] if fees_row else 0,
                )

                # Get recent notes (last 5, pinned first)
                await cur.execute(
                    """
                    SELECT id, title, note_type, is_pinned, created_at, updated_at
                    FROM office_api.notes
                    WHERE user_id = %s AND client_id = %s
                    ORDER BY is_pinned DESC, updated_at DESC
                    LIMIT 5
                    """,
                    (str(user_id), str(client_id)),
                )
                notes_rows = await cur.fetchall()
                recent_notes = [ClientNoteSummary(**row) for row in notes_rows]

                # Get total notes count
                await cur.execute(
                    """
                    SELECT COUNT(*) as count
                    FROM office_api.notes
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                notes_count_row = await cur.fetchone()
                notes_count = notes_count_row["count"] if notes_count_row else 0

                # Get services summary
                await cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(value), 0) as total_amount,
                        COALESCE(SUM(paid_amount), 0) as total_paid,
                        COALESCE(SUM(COALESCE(value, 0) - paid_amount), 0) as total_pending,
                        COUNT(*) as services_count,
                        COUNT(*) FILTER (WHERE status = 'active') as active_count,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed_count
                    FROM office_api.services
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                services_row = await cur.fetchone()
                services_summary = ClientServiceSummary(
                    total_amount=float(services_row["total_amount"]) if services_row else 0,
                    total_paid=float(services_row["total_paid"]) if services_row else 0,
                    total_pending=float(services_row["total_pending"]) if services_row else 0,
                    services_count=services_row["services_count"] if services_row else 0,
                    active_count=services_row["active_count"] if services_row else 0,
                    completed_count=services_row["completed_count"] if services_row else 0,
                )

                return ClientDetailResponse(
                    **client_row,
                    processes=processes,
                    processes_count=len(processes),
                    fees_summary=fees_summary,
                    services_summary=services_summary,
                    services_count=services_summary.services_count,
                    recent_notes=recent_notes,
                    notes_count=notes_count,
                )


clients_service = ClientsService()
