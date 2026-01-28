from datetime import datetime

from fastapi import APIRouter, Depends, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.calendar.schemas import (
    EventCreateRequest,
    EventListParams,
    EventListResponse,
    EventResponse,
    EventType,
    EventUpdateRequest,
)
from src.features.office.calendar.service import calendar_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


# === Events Endpoints ===


@router.get("/events", response_model=EventListResponse)
async def list_events(
    start: datetime = Query(..., description="Start date for event range"),
    end: datetime = Query(..., description="End date for event range"),
    calendar_id: str | None = Query(None, description="Filter by calendar ID"),
    event_type: EventType | None = Query(None, description="Filter by event type"),
    user_id: str = Depends(get_user_id),
):
    """List events within a date range."""
    params = EventListParams(
        start=start,
        end=end,
        calendar_id=calendar_id,
        event_type=event_type,
    )
    events, total = await calendar_service.list_events(user_id, params)
    return EventListResponse(events=events, total=total)


@router.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: EventCreateRequest,
    user_id: str = Depends(get_user_id),
):
    """Create a new event."""
    return await calendar_service.create_event(user_id, data)


@router.get("/events/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single event by ID."""
    return await calendar_service.get_event(user_id, event_id)


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    data: EventUpdateRequest,
    user_id: str = Depends(get_user_id),
):
    """Update an existing event."""
    return await calendar_service.update_event(user_id, event_id, data)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    user_id: str = Depends(get_user_id),
):
    """Delete an event."""
    await calendar_service.delete_event(user_id, event_id)
    return None
