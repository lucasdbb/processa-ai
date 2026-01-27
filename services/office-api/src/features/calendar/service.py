from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status

from src.core.db import get_db_pool
from src.core.logging import logger
from src.features.calendar.schemas import (
    EventCreateRequest,
    EventListParams,
    EventResponse,
    EventUpdateRequest,
)


class CalendarService:
    """Service for calendar and event operations."""

    # === Events CRUD ===

    async def list_events(
        self,
        user_id: str,
        params: EventListParams,
    ) -> tuple[list[EventResponse], int]:
        """List events for a user within a date range."""
        pool = get_db_pool()

        query = """
            SELECT
                id, user_id, calendar_id, google_event_id,
                title, description, location,
                start_at, end_at, all_day,
                event_type, status,
                processo_id, cliente_id, color,
                reminder_minutes, source, sync_status,
                created_at, updated_at
            FROM office_api.events
            WHERE user_id = %s
              AND start_at >= %s
              AND end_at <= %s
        """
        query_params: list[Any] = [user_id, params.start, params.end]

        if params.calendar_id:
            query += " AND calendar_id = %s"
            query_params.append(params.calendar_id)

        if params.event_type:
            query += " AND event_type = %s"
            query_params.append(params.event_type)

        query += " ORDER BY start_at ASC"

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, query_params)
                rows = await cur.fetchall()

                events = [self._row_to_event(row) for row in rows]

                # Get total count
                count_query = """
                    SELECT COUNT(*) FROM office_api.events
                    WHERE user_id = %s AND start_at >= %s AND end_at <= %s
                """
                await cur.execute(count_query, [user_id, params.start, params.end])
                total_row = await cur.fetchone()
                total = total_row[0] if total_row else 0

        return events, total

    async def get_event(self, user_id: str, event_id: str) -> EventResponse:
        """Get a single event by ID."""
        pool = get_db_pool()

        query = """
            SELECT
                id, user_id, calendar_id, google_event_id,
                title, description, location,
                start_at, end_at, all_day,
                event_type, status,
                processo_id, cliente_id, color,
                reminder_minutes, source, sync_status,
                created_at, updated_at
            FROM office_api.events
            WHERE id = %s AND user_id = %s
        """

        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, [event_id, user_id])
                row = await cur.fetchone()

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found",
            )

        return self._row_to_event(row)

    async def create_event(
        self,
        user_id: str,
        data: EventCreateRequest,
    ) -> EventResponse:
        """Create a new event."""
        pool = get_db_pool()

        event_id = str(uuid4())
        now = datetime.now(timezone.utc)

        query = """
            INSERT INTO office_api.events (
                id, user_id, calendar_id,
                title, description, location,
                start_at, end_at, all_day,
                event_type, status,
                processo_id, cliente_id, color,
                reminder_minutes, source, sync_status,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            RETURNING
                id, user_id, calendar_id, google_event_id,
                title, description, location,
                start_at, end_at, all_day,
                event_type, status,
                processo_id, cliente_id, color,
                reminder_minutes, source, sync_status,
                created_at, updated_at
        """

        params = [
            event_id,
            user_id,
            data.calendar_id,
            data.title,
            data.description,
            data.location,
            data.start_at,
            data.end_at,
            data.all_day,
            data.event_type,
            "confirmed",
            data.processo_id,
            data.cliente_id,
            data.color,
            data.reminder_minutes,
            "local",
            "pending_sync",
            now,
            now,
        ]

        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, params)
                    row = await cur.fetchone()
                    await conn.commit()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create event",
                )

            logger.info(f"Created event {event_id} for user {user_id}")
            return self._row_to_event(row)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create event: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create event",
            )

    async def update_event(
        self,
        user_id: str,
        event_id: str,
        data: EventUpdateRequest,
    ) -> EventResponse:
        """Update an existing event."""
        # First check if event exists
        await self.get_event(user_id, event_id)

        pool = get_db_pool()
        now = datetime.now(timezone.utc)

        # Build dynamic update query
        updates = []
        params = []

        if data.title is not None:
            updates.append("title = %s")
            params.append(data.title)

        if data.description is not None:
            updates.append("description = %s")
            params.append(data.description)

        if data.location is not None:
            updates.append("location = %s")
            params.append(data.location)

        if data.start_at is not None:
            updates.append("start_at = %s")
            params.append(data.start_at)

        if data.end_at is not None:
            updates.append("end_at = %s")
            params.append(data.end_at)

        if data.all_day is not None:
            updates.append("all_day = %s")
            params.append(data.all_day)

        if data.event_type is not None:
            updates.append("event_type = %s")
            params.append(data.event_type)

        if data.processo_id is not None:
            updates.append("processo_id = %s")
            params.append(data.processo_id)

        if data.cliente_id is not None:
            updates.append("cliente_id = %s")
            params.append(data.cliente_id)

        if data.color is not None:
            updates.append("color = %s")
            params.append(data.color)

        if data.reminder_minutes is not None:
            updates.append("reminder_minutes = %s")
            params.append(data.reminder_minutes)

        if not updates:
            return await self.get_event(user_id, event_id)

        # Mark as pending sync after local update
        updates.append("sync_status = %s")
        params.append("pending_sync")

        updates.append("updated_at = %s")
        params.append(now)

        params.extend([event_id, user_id])

        query = f"""
            UPDATE office_api.events
            SET {', '.join(updates)}
            WHERE id = %s AND user_id = %s
            RETURNING
                id, user_id, calendar_id, google_event_id,
                title, description, location,
                start_at, end_at, all_day,
                event_type, status,
                processo_id, cliente_id, color,
                reminder_minutes, source, sync_status,
                created_at, updated_at
        """

        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, params)
                    row = await cur.fetchone()
                    await conn.commit()

            if not row:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update event",
                )

            logger.info(f"Updated event {event_id} for user {user_id}")
            return self._row_to_event(row)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to update event: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update event",
            )

    async def delete_event(self, user_id: str, event_id: str) -> None:
        """Delete an event."""
        # First check if event exists
        await self.get_event(user_id, event_id)

        pool = get_db_pool()

        query = "DELETE FROM office_api.events WHERE id = %s AND user_id = %s"

        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(query, [event_id, user_id])
                    await conn.commit()

            logger.info(f"Deleted event {event_id} for user {user_id}")

        except Exception as e:
            logger.error(f"Failed to delete event: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete event",
            )

    # === Helper Methods ===

    def _row_to_event(self, row: tuple) -> EventResponse:
        """Convert a database row to EventResponse."""
        return EventResponse(
            id=str(row[0]),
            user_id=str(row[1]),
            calendar_id=str(row[2]) if row[2] else None,
            google_event_id=row[3],
            title=row[4],
            description=row[5],
            location=row[6],
            start_at=row[7],
            end_at=row[8],
            all_day=row[9],
            event_type=row[10],
            status=row[11],
            processo_id=str(row[12]) if row[12] else None,
            cliente_id=str(row[13]) if row[13] else None,
            color=row[14],
            reminder_minutes=row[15] or [],
            source=row[16],
            sync_status=row[17],
            created_at=row[18],
            updated_at=row[19],
        )


calendar_service = CalendarService()
