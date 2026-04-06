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

    async def export_clients(self, user_id: UUID) -> str:
        """Export all clients as CSV."""
        from src.shared.csv_export import rows_to_csv

        pool = await get_pool()
        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT name, email, phone, cpf_cnpj, address, city, state,
                           zip_code, status, created_at
                    FROM office_api.clients
                    WHERE user_id = %s
                    ORDER BY name ASC
                    """,
                    (str(user_id),),
                )
                rows = await cur.fetchall()

        headers = [
            "Nome", "Email", "Telefone", "CPF/CNPJ", "Endereço",
            "Cidade", "Estado", "CEP", "Status", "Cadastrado em",
        ]
        data = [
            [
                r["name"], r["email"] or "", r["phone"] or "",
                r["cpf_cnpj"] or "", r["address"] or "",
                r["city"] or "", r["state"] or "", r["zip_code"] or "",
                r["status"], r["created_at"].strftime("%d/%m/%Y") if r["created_at"] else "",
            ]
            for r in rows
        ]
        return rows_to_csv(headers, data)

    async def count_clients(self, user_id: UUID) -> dict[str, int]:
        """Count active clients for a user."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT COUNT(*) as total
                    FROM office_api.clients
                    WHERE user_id = %s AND status = 'active'
                    """,
                    (str(user_id),),
                )
                row = await cur.fetchone()
                return {"total": row["total"] if row else 0}

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

        # Filter out None values with column allowlist
        ALLOWED_FIELDS = {
            "name",
            "email",
            "phone",
            "cpf_cnpj",
            "address",
            "city",
            "state",
            "zip_code",
            "notes",
            "status",
        }
        update_data = {
            k: v for k, v in data.model_dump().items() if v is not None and k in ALLOWED_FIELDS
        }

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
        """Get aggregated client detail with processes, fees, notes, and services.

        Uses a single query with subqueries to avoid N+1 problem
        (previously 5 separate queries).
        """
        pool = await get_pool()
        uid = str(user_id)
        cid = str(client_id)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Single query: client + aggregated fees/services/notes via subqueries
                await cur.execute(
                    """
                    SELECT
                        c.*,
                        -- Fees summary
                        COALESCE(f.total_amount, 0)  AS fees_total_amount,
                        COALESCE(f.total_paid, 0)     AS fees_total_paid,
                        COALESCE(f.total_pending, 0)  AS fees_total_pending,
                        COALESCE(f.total_overdue, 0)  AS fees_total_overdue,
                        COALESCE(f.fees_count, 0)     AS fees_count,
                        -- Services summary
                        COALESCE(s.total_amount, 0)   AS svc_total_amount,
                        COALESCE(s.total_paid, 0)     AS svc_total_paid,
                        COALESCE(s.total_pending, 0)  AS svc_total_pending,
                        COALESCE(s.services_count, 0) AS svc_services_count,
                        COALESCE(s.active_count, 0)   AS svc_active_count,
                        COALESCE(s.completed_count, 0) AS svc_completed_count,
                        -- Notes count
                        COALESCE(n.notes_count, 0)    AS notes_count
                    FROM office_api.clients c
                    LEFT JOIN LATERAL (
                        SELECT
                            SUM(amount)  AS total_amount,
                            SUM(paid_amount) AS total_paid,
                            SUM(CASE WHEN status = 'pending'
                                     THEN amount - COALESCE(paid_amount, 0) ELSE 0 END) AS total_pending,
                            SUM(CASE WHEN status = 'overdue'
                                     THEN amount - COALESCE(paid_amount, 0) ELSE 0 END) AS total_overdue,
                            COUNT(*) AS fees_count
                        FROM office_api.fees
                        WHERE user_id = c.user_id AND client_id = c.id
                    ) f ON true
                    LEFT JOIN LATERAL (
                        SELECT
                            SUM(value) AS total_amount,
                            SUM(paid_amount) AS total_paid,
                            SUM(COALESCE(value, 0) - paid_amount) AS total_pending,
                            COUNT(*) AS services_count,
                            COUNT(*) FILTER (WHERE status = 'active') AS active_count,
                            COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
                        FROM office_api.services
                        WHERE user_id = c.user_id AND client_id = c.id
                    ) s ON true
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS notes_count
                        FROM office_api.notes
                        WHERE user_id = c.user_id AND client_id = c.id
                    ) n ON true
                    WHERE c.user_id = %s AND c.id = %s
                    """,
                    (uid, cid),
                )
                row = await cur.fetchone()

                if not row:
                    return None

                # Extract aggregated summaries from the single row
                fees_summary = ClientFeeSummary(
                    total_amount=float(row.pop("fees_total_amount")),
                    total_paid=float(row.pop("fees_total_paid")),
                    total_pending=float(row.pop("fees_total_pending")),
                    total_overdue=float(row.pop("fees_total_overdue")),
                    fees_count=row.pop("fees_count"),
                )
                services_summary = ClientServiceSummary(
                    total_amount=float(row.pop("svc_total_amount")),
                    total_paid=float(row.pop("svc_total_paid")),
                    total_pending=float(row.pop("svc_total_pending")),
                    services_count=row.pop("svc_services_count"),
                    active_count=row.pop("svc_active_count"),
                    completed_count=row.pop("svc_completed_count"),
                )
                notes_count = row.pop("notes_count")

                # Second query: processes with next deadline + recent notes
                # (these return multiple rows so can't be embedded in the main query)
                await cur.execute(
                    """
                    SELECT
                        p.id,
                        p.process_number AS number,
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
                        ) AS next_deadline
                    FROM office_api.processes p
                    WHERE p.user_id = %s AND p.client_id = %s
                    ORDER BY p.created_at DESC
                    """,
                    (uid, cid),
                )
                process_rows = await cur.fetchall()
                processes = [
                    ClientProcessSummary(
                        id=r["id"],
                        number=r["number"],
                        type=r["type"],
                        status=r["status"],
                        court=r["court"],
                        value=float(r["value"]) if r["value"] else None,
                        next_deadline=r["next_deadline"],
                    )
                    for r in process_rows
                ]

                await cur.execute(
                    """
                    SELECT id, title, note_type, is_pinned, created_at, updated_at
                    FROM office_api.notes
                    WHERE user_id = %s AND client_id = %s
                    ORDER BY is_pinned DESC, updated_at DESC
                    LIMIT 5
                    """,
                    (uid, cid),
                )
                recent_notes = [ClientNoteSummary(**r) for r in await cur.fetchall()]

                return ClientDetailResponse(
                    **row,
                    processes=processes,
                    processes_count=len(processes),
                    fees_summary=fees_summary,
                    services_summary=services_summary,
                    services_count=services_summary.services_count,
                    recent_notes=recent_notes,
                    notes_count=notes_count,
                )


clients_service = ClientsService()
