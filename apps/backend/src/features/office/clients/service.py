from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.clients.schemas import (
    ClientCreate,
    ClientListParams,
    ClientResponse,
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
                        data.status or "active",
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


clients_service = ClientsService()
