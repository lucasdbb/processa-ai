"""Notes/Anotacoes service."""

from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.notes.schemas import (
    NoteCreate,
    NoteListParams,
    NoteResponse,
    NoteUpdate,
)


class NotesService:
    """Service for managing notes."""

    async def list_notes(
        self, user_id: UUID, params: NoteListParams
    ) -> tuple[list[NoteResponse], int]:
        """List notes for a user with optional filters."""
        pool = await get_pool()

        where_conditions = ["n.user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.client_id:
            where_conditions.append("n.client_id = %s")
            query_params.append(str(params.client_id))

        if params.process_id:
            where_conditions.append("n.process_id = %s")
            query_params.append(str(params.process_id))

        if params.note_type:
            where_conditions.append("n.note_type = %s")
            query_params.append(params.note_type)

        if params.pinned_only:
            where_conditions.append("n.is_pinned = true")

        if params.search:
            where_conditions.append("(n.title ILIKE %s OR n.content ILIKE %s)")
            search_term = f"%{params.search}%"
            query_params.extend([search_term, search_term])

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Count query
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM office_api.notes n
                    WHERE {where_clause}
                """
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                # Data query with client/process info
                data_query = f"""
                    SELECT
                        n.*,
                        c.name as client_name,
                        p.process_number as process_number
                    FROM office_api.notes n
                    LEFT JOIN office_api.clients c ON n.client_id = c.id
                    LEFT JOIN office_api.processes p ON n.process_id = p.id
                    WHERE {where_clause}
                    ORDER BY n.is_pinned DESC, n.updated_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(data_query, query_params + [params.limit, params.offset])
                rows = await cur.fetchall()

                notes = [NoteResponse(**row) for row in rows]
                return notes, total

    async def get_note(self, user_id: UUID, note_id: UUID) -> NoteResponse | None:
        """Get a single note by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT
                        n.*,
                        c.name as client_name,
                        p.process_number as process_number
                    FROM office_api.notes n
                    LEFT JOIN office_api.clients c ON n.client_id = c.id
                    LEFT JOIN office_api.processes p ON n.process_id = p.id
                    WHERE n.id = %s AND n.user_id = %s
                    """,
                    (str(note_id), str(user_id)),
                )
                row = await cur.fetchone()
                return NoteResponse(**row) if row else None

    async def create_note(self, user_id: UUID, data: NoteCreate) -> NoteResponse:
        """Create a new note."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.notes (
                        user_id, client_id, process_id, note_type,
                        title, content, is_pinned
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.client_id) if data.client_id else None,
                        str(data.process_id) if data.process_id else None,
                        data.note_type,
                        data.title,
                        data.content,
                        data.is_pinned,
                    ),
                )
                row = await cur.fetchone()
                note_id = row["id"]

        # Fetch with joined data
        return await self.get_note(user_id, note_id)  # type: ignore

    async def update_note(
        self, user_id: UUID, note_id: UUID, data: NoteUpdate
    ) -> NoteResponse | None:
        """Update an existing note."""
        ALLOWED_FIELDS = {"note_type", "title", "content", "is_pinned"}
        update_data = {
            k: v for k, v in data.model_dump().items() if v is not None and k in ALLOWED_FIELDS
        }
        if not update_data:
            return await self.get_note(user_id, note_id)

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.notes
                    SET {set_clause}, updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                    """,
                    values + [str(note_id), str(user_id)],
                )
                row = await cur.fetchone()

                if not row:
                    return None

        return await self.get_note(user_id, note_id)

    async def delete_note(self, user_id: UUID, note_id: UUID) -> bool:
        """Delete a note."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    DELETE FROM office_api.notes
                    WHERE id = %s AND user_id = %s
                    """,
                    (str(note_id), str(user_id)),
                )
                return cur.rowcount > 0

    async def toggle_pin(self, user_id: UUID, note_id: UUID) -> NoteResponse | None:
        """Toggle the pinned status of a note."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    UPDATE office_api.notes
                    SET is_pinned = NOT is_pinned, updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                    """,
                    (str(note_id), str(user_id)),
                )
                row = await cur.fetchone()

                if not row:
                    return None

        return await self.get_note(user_id, note_id)


notes_service = NotesService()
