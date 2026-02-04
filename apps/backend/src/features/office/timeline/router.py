"""Timeline/Andamentos router."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.timeline.schemas import (
    TimelineEventCreate,
    TimelineEventResponse,
    TimelineEventType,
    TimelineEventUpdate,
    TimelineListParams,
    TimelineListResponse,
)
from src.features.office.timeline.service import timeline_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=TimelineListResponse)
async def list_timeline_events(
    process_id: UUID | None = Query(None, description="Filter by process ID"),
    event_type: TimelineEventType | None = Query(None, description="Filter by event type"),
    start_date: datetime | None = Query(None, description="Filter events after this date"),
    end_date: datetime | None = Query(None, description="Filter events before this date"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List timeline events for the current user."""
    params = TimelineListParams(
        process_id=process_id,
        event_type=event_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    events, total = await timeline_service.list_events(user_id, params)
    return TimelineListResponse(events=events, total=total)


@router.get("/{event_id}", response_model=TimelineEventResponse)
async def get_timeline_event(
    event_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single timeline event by ID."""
    event = await timeline_service.get_event(user_id, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timeline event not found",
        )
    return event


@router.post("", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
async def create_timeline_event(
    data: TimelineEventCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new timeline event."""
    return await timeline_service.create_event(user_id, data)


@router.put("/{event_id}", response_model=TimelineEventResponse)
async def update_timeline_event(
    event_id: UUID,
    data: TimelineEventUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing timeline event."""
    event = await timeline_service.update_event(user_id, event_id, data)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timeline event not found",
        )
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_timeline_event(
    event_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a timeline event."""
    deleted = await timeline_service.delete_event(user_id, event_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timeline event not found",
        )
