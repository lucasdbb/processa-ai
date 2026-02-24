"""Services service."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.services.schemas import (
    ServiceClientInfo,
    ServiceCreate,
    ServiceDetailResponse,
    ServiceDocumentSummary,
    ServiceListParams,
    ServiceResponse,
    ServiceSummaryResponse,
    ServiceUpdate,
)


class ServicesService:
    """Service for service operations."""

    async def list_services(
        self,
        user_id: UUID,
        params: ServiceListParams,
    ) -> tuple[list[ServiceResponse], int]:
        """List services for a user."""
        pool = await get_pool()

        where_conditions = ["s.user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.client_id:
            where_conditions.append("s.client_id = %s")
            query_params.append(str(params.client_id))

        if params.search:
            where_conditions.append("s.name ILIKE %s")
            query_params.append(f"%{params.search}%")

        if params.category:
            where_conditions.append("s.category = %s")
            query_params.append(params.category)

        if params.status:
            where_conditions.append("s.status = %s")
            query_params.append(params.status)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM office_api.services s
                    WHERE {where_clause}
                """
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                data_query = f"""
                    SELECT s.*, c.name as client_name
                    FROM office_api.services s
                    LEFT JOIN office_api.clients c ON s.client_id = c.id
                    WHERE {where_clause}
                    ORDER BY s.created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                services = [ServiceResponse(**row) for row in rows]
                return services, total

    async def count_services(self, user_id: UUID) -> dict[str, int]:
        """Count active services for a user."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT COUNT(*) as total
                    FROM office_api.services
                    WHERE user_id = %s AND status = 'active'
                    """,
                    (str(user_id),),
                )
                row = await cur.fetchone()
                return {"total": row["total"] if row else 0}

    async def get_service(self, user_id: UUID, service_id: UUID) -> ServiceResponse | None:
        """Get a single service by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT * FROM office_api.services
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(service_id)),
                )
                row = await cur.fetchone()
                return ServiceResponse(**row) if row else None

    async def get_service_detail(
        self, user_id: UUID, service_id: UUID
    ) -> ServiceDetailResponse | None:
        """Get aggregated service detail with client and documents."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # 1. Get service basic info
                await cur.execute(
                    "SELECT * FROM office_api.services WHERE user_id = %s AND id = %s",
                    (str(user_id), str(service_id)),
                )
                service_row = await cur.fetchone()
                if not service_row:
                    return None

                # 2. Get client info
                await cur.execute(
                    """
                    SELECT id, name, email, phone, cpf_cnpj
                    FROM office_api.clients
                    WHERE id = %s AND user_id = %s
                    """,
                    (str(service_row["client_id"]), str(user_id)),
                )
                client_row = await cur.fetchone()
                client = (
                    ServiceClientInfo(**client_row)
                    if client_row
                    else ServiceClientInfo(
                        id=service_row["client_id"],
                        name="Cliente não encontrado",
                        email=None,
                        phone=None,
                        cpf_cnpj=None,
                    )
                )

                # 3. Get documents
                await cur.execute(
                    """
                    SELECT id, name, mime_type, file_size, file_url, created_at
                    FROM office_api.documents
                    WHERE user_id = %s AND service_id = %s
                    ORDER BY created_at DESC
                    """,
                    (str(user_id), str(service_id)),
                )
                document_rows = await cur.fetchall()
                documents = [ServiceDocumentSummary(**row) for row in document_rows]

                return ServiceDetailResponse(
                    **service_row,
                    client=client,
                    documents=documents,
                    documents_count=len(documents),
                )

    async def create_service(self, user_id: UUID, data: ServiceCreate) -> ServiceResponse:
        """Create a new service."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.services (
                        user_id, client_id, name, category, status,
                        value, paid_amount, notes
                    )
                    VALUES (%s, %s, %s, %s, 'active', %s, 0, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.client_id),
                        data.name,
                        data.category,
                        data.value,
                        data.notes,
                    ),
                )
                row = await cur.fetchone()
                return ServiceResponse(**row)

    async def update_service(
        self, user_id: UUID, service_id: UUID, data: ServiceUpdate
    ) -> ServiceResponse | None:
        """Update an existing service."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_service(user_id, service_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.services
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(service_id)],
                )
                row = await cur.fetchone()
                return ServiceResponse(**row) if row else None

    async def delete_service(self, user_id: UUID, service_id: UUID) -> bool:
        """Delete a service."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    DELETE FROM office_api.services
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(service_id)),
                )
                return cur.rowcount > 0

    async def get_summary_by_client(self, user_id: UUID, client_id: UUID) -> ServiceSummaryResponse:
        """Get service summary for a client."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(value), 0) as total_amount,
                        COALESCE(SUM(paid_amount), 0) as total_paid,
                        COALESCE(SUM(
                            CASE WHEN status IN ('active', 'completed') AND value IS NOT NULL
                            THEN value - paid_amount ELSE 0 END
                        ), 0) as total_pending,
                        COUNT(*) as services_count,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
                    FROM office_api.services
                    WHERE user_id = %s AND client_id = %s
                    """,
                    (str(user_id), str(client_id)),
                )
                row = await cur.fetchone()

                if not row:
                    return ServiceSummaryResponse(
                        total_amount=Decimal(0),
                        total_paid=Decimal(0),
                        total_pending=Decimal(0),
                        services_count=0,
                        active_count=0,
                        completed_count=0,
                    )

                return ServiceSummaryResponse(**row)

    async def mark_as_paid(
        self, user_id: UUID, service_id: UUID, paid_amount: Decimal | None = None
    ) -> ServiceResponse | None:
        """Mark a service as paid (full or partial)."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM office_api.services WHERE user_id = %s AND id = %s",
                    (str(user_id), str(service_id)),
                )
                service = await cur.fetchone()
                if not service:
                    return None

                new_paid = paid_amount if paid_amount is not None else (service["value"] or Decimal(0))
                new_status = service["status"]
                if service["value"] and new_paid >= service["value"]:
                    new_status = "completed"

                await cur.execute(
                    """
                    UPDATE office_api.services
                    SET paid_amount = %s, status = %s, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    (new_paid, new_status, str(user_id), str(service_id)),
                )
                row = await cur.fetchone()
                return ServiceResponse(**row) if row else None


services_service = ServicesService()
