from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.deadlines.schemas import (
    DeadlineCreate,
    DeadlineListParams,
    DeadlineListResponse,
    DeadlinePriority,
    DeadlineResponse,
    DeadlineStatus,
    DeadlineUpdate,
)
from src.features.office.deadlines.service import deadlines_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=DeadlineListResponse)
async def list_deadlines(
    start_date: date | None = Query(None, description="Filter from date"),
    end_date: date | None = Query(None, description="Filter until date"),
    status: DeadlineStatus | None = Query(None, description="Filter by status"),
    priority: DeadlinePriority | None = Query(None, description="Filter by priority"),
    process_id: UUID | None = Query(None, description="Filter by process ID"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List deadlines for the current user."""
    params = DeadlineListParams(
        start_date=start_date,
        end_date=end_date,
        status=status,
        priority=priority,
        process_id=process_id,
        limit=limit,
        offset=offset,
    )
    deadlines, total = await deadlines_service.list_deadlines(user_id, params)
    return DeadlineListResponse(deadlines=deadlines, total=total)


@router.get("/{deadline_id}", response_model=DeadlineResponse)
async def get_deadline(
    deadline_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single deadline by ID."""
    deadline = await deadlines_service.get_deadline(user_id, deadline_id)
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deadline not found",
        )
    return deadline


@router.post("", response_model=DeadlineResponse, status_code=status.HTTP_201_CREATED)
async def create_deadline(
    data: DeadlineCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new deadline."""
    return await deadlines_service.create_deadline(user_id, data)


@router.put("/{deadline_id}", response_model=DeadlineResponse)
async def update_deadline(
    deadline_id: UUID,
    data: DeadlineUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing deadline."""
    deadline = await deadlines_service.update_deadline(user_id, deadline_id, data)
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deadline not found",
        )
    return deadline


@router.delete("/{deadline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deadline(
    deadline_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a deadline."""
    deleted = await deadlines_service.delete_deadline(user_id, deadline_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deadline not found",
        )

    """Delete a deadline."""
    deleted = await deadlines_service.delete_deadline(user_id, deadline_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deadline not found",
        )
    return None
