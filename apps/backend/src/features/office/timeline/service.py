"""Timeline/Andamentos service."""

import json
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from src.core.db import get_pool
from src.features.office.timeline.schemas import (
    TimelineEventCreate,
    TimelineEventResponse,
    TimelineEventUpdate,
    TimelineListParams,
)


class TimelineService:
    """Service for timeline event operations."""

    async def list_events(
        self,
        user_id: UUID,
        params: TimelineListParams,
    ) -> tuple[list[TimelineEventResponse], int]:
        """List timeline events for a user."""
        pool = await get_pool()

        where_conditions = ["user_id = %s"]
        query_params: list[Any] = [str(user_id)]

        if params.process_id:
            where_conditions.append("process_id = %s")
            query_params.append(str(params.process_id))

        if params.event_type:
            where_conditions.append("event_type = %s")
            query_params.append(params.event_type)

        if params.start_date:
            where_conditions.append("event_date >= %s")
            query_params.append(params.start_date)

        if params.end_date:
            where_conditions.append("event_date <= %s")
            query_params.append(params.end_date)

        where_clause = " AND ".join(where_conditions)

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Count query
                count_query = f"""
                    SELECT COUNT(*) as total
                    FROM office_api.timeline_events
                    WHERE {where_clause}
                """
                await cur.execute(count_query, query_params)
                count_result = await cur.fetchone()
                total = count_result["total"] if count_result else 0

                # Data query
                data_query = f"""
                    SELECT *
                    FROM office_api.timeline_events
                    WHERE {where_clause}
                    ORDER BY event_date DESC, created_at DESC
                    LIMIT %s OFFSET %s
                """
                await cur.execute(
                    data_query, query_params + [params.limit, params.offset]
                )
                rows = await cur.fetchall()

                events = [TimelineEventResponse(**row) for row in rows]
                return events, total

    async def get_event(
        self, user_id: UUID, event_id: UUID
    ) -> TimelineEventResponse | None:
        """Get a single timeline event by ID."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT * FROM office_api.timeline_events
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(event_id)),
                )
                row = await cur.fetchone()
                return TimelineEventResponse(**row) if row else None

    async def create_event(
        self, user_id: UUID, data: TimelineEventCreate
    ) -> TimelineEventResponse:
        """Create a new timeline event."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    INSERT INTO office_api.timeline_events (
                        user_id, process_id, event_type, title,
                        description, event_date, metadata
                    )
                    VALUES (%s, %s, %s, %s, %s, COALESCE(%s, NOW()), %s)
                    RETURNING *
                    """,
                    (
                        str(user_id),
                        str(data.process_id),
                        data.event_type,
                        data.title,
                        data.description,
                        data.event_date,
                        json.dumps(data.metadata) if data.metadata else None,
                    ),
                )
                row = await cur.fetchone()
                return TimelineEventResponse(**row)

    async def update_event(
        self, user_id: UUID, event_id: UUID, data: TimelineEventUpdate
    ) -> TimelineEventResponse | None:
        """Update an existing timeline event."""
        pool = await get_pool()

        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_event(user_id, event_id)

        # Handle metadata serialization
        if "metadata" in update_data and update_data["metadata"] is not None:
            update_data["metadata"] = json.dumps(update_data["metadata"])

        set_clauses = [f"{k} = %s" for k in update_data.keys()]
        set_clause = ", ".join(set_clauses)
        values = list(update_data.values())

        async with pool.connection() as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    f"""
                    UPDATE office_api.timeline_events
                    SET {set_clause}, updated_at = NOW()
                    WHERE user_id = %s AND id = %s
                    RETURNING *
                    """,
                    values + [str(user_id), str(event_id)],
                )
                row = await cur.fetchone()
                return TimelineEventResponse(**row) if row else None

    async def delete_event(self, user_id: UUID, event_id: UUID) -> bool:
        """Delete a timeline event."""
        pool = await get_pool()

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    DELETE FROM office_api.timeline_events
                    WHERE user_id = %s AND id = %s
                    """,
                    (str(user_id), str(event_id)),
                )
                return cur.rowcount > 0

    async def create_system_event(
        self,
        user_id: UUID,
        process_id: UUID,
        event_type: str,
        title: str,
        description: str | None = None,
        metadata: dict | None = None,
    ) -> TimelineEventResponse:
        """Create a system-generated timeline event."""
        return await self.create_event(
            user_id,
            TimelineEventCreate(
                process_id=process_id,
                event_type=event_type,  # type: ignore
                title=title,
                description=description,
                metadata=metadata,
            ),
        )


timeline_service = TimelineService()
