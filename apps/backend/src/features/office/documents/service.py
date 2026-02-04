from uuid import UUID, uuid4

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.documents.schemas import (
    DocumentCreate,
    DocumentListParams,
    DocumentResponse,
    DocumentUpdate,
)

# Mock data - lista vazia por enquanto (como no frontend)
MOCK_DOCUMENTS: list[dict] = []


def _convert_uuids_to_str(row: dict) -> dict:
    """Convert UUID objects to strings in a row dict."""
    return {k: str(v) if isinstance(v, UUID) else v for k, v in row.items()}


class DocumentsService:
    """Service for document operations."""

    async def list_documents(
        self,
        user_id: str,
        params: DocumentListParams,
    ) -> tuple[list[DocumentResponse], int]:
        """List documents for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s"]
        query_params: list = [user_id]

        if params.search:
            where_conditions.append("(name ILIKE %s OR description ILIKE %s)")
            search_pattern = f"%{params.search}%"
            query_params.extend([search_pattern, search_pattern])

        if params.type:
            where_conditions.append("type = %s")
            query_params.append(params.type)

        if params.status:
            where_conditions.append("status = %s")
            query_params.append(params.status)

        if params.process_id:
            where_conditions.append("process_id = %s")
            query_params.append(params.process_id)

        if params.client_id:
            where_conditions.append("client_id = %s")
            query_params.append(params.client_id)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Count total
                count_query = (
                    f"SELECT COUNT(*) as total FROM office_api.documents WHERE {where_clause}"
                )
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                # Get paginated data
                data_query = f"""
                    SELECT * FROM office_api.documents
                    WHERE {where_clause}
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                documents = [DocumentResponse(**_convert_uuids_to_str(row)) for row in rows]
                return documents, total

    async def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
        """Get a single document by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    "SELECT * FROM office_api.documents WHERE user_id = %s AND id = %s",
                    (user_id, document_id),
                )
                row = await cur.fetchone()
                return DocumentResponse(**_convert_uuids_to_str(row)) if row else None

    async def create_document(self, user_id: str, data: DocumentCreate) -> DocumentResponse:
        """Create a new document."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.documents (
                        id, user_id, name, type, status, file_url, file_size,
                        mime_type, process_id, client_id, description
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(uuid4()),
                        user_id,
                        data.name,
                        data.type,
                        data.status,
                        data.file_url,
                        data.file_size,
                        data.mime_type,
                        data.process_id,
                        data.client_id,
                        data.description,
                    ),
                )
                row = await cur.fetchone()
                return DocumentResponse(**_convert_uuids_to_str(row))

    async def update_document(
        self, user_id: str, document_id: str, data: DocumentUpdate
    ) -> DocumentResponse | None:
        """Update an existing document."""
        pool = await get_pool()

        # Build dynamic update query
        set_clauses = []
        params = []

        if data.name is not None:
            set_clauses.append("name = %s")
            params.append(data.name)
        if data.type is not None:
            set_clauses.append("type = %s")
            params.append(data.type)
        if data.status is not None:
            set_clauses.append("status = %s")
            params.append(data.status)
        if data.file_url is not None:
            set_clauses.append("file_url = %s")
            params.append(data.file_url)
        if data.file_size is not None:
            set_clauses.append("file_size = %s")
            params.append(data.file_size)
        if data.mime_type is not None:
            set_clauses.append("mime_type = %s")
            params.append(data.mime_type)
        if data.process_id is not None:
            set_clauses.append("process_id = %s")
            params.append(data.process_id)
        if data.client_id is not None:
            set_clauses.append("client_id = %s")
            params.append(data.client_id)
        if data.description is not None:
            set_clauses.append("description = %s")
            params.append(data.description)

        if not set_clauses:
            # Nothing to update, return current document
            return await self.get_document(user_id, document_id)

        params.extend([user_id, document_id])

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                query = f"""
                    UPDATE office_api.documents
                    SET {", ".join(set_clauses)}
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                """
                await cur.execute(query, params)
                row = await cur.fetchone()
                return DocumentResponse(**_convert_uuids_to_str(row)) if row else None

    async def delete_document(self, user_id: str, document_id: str) -> bool:
        """Delete a document."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "DELETE FROM office_api.documents WHERE user_id = %s AND id = %s",
                    (user_id, document_id),
                )
                return cur.rowcount > 0


documents_service = DocumentsService()
