from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.dependencies import get_user_id, verify_internal_token
from src.features.deadlines.schemas import (
    DeadlineListParams,
    DeadlineListResponse,
    DeadlineResponse,
    DeadlineStatus,
)
from src.features.deadlines.service import deadlines_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=DeadlineListResponse)
async def list_deadlines(
    start_date: datetime | None = Query(None, description="Filter from date"),
    end_date: datetime | None = Query(None, description="Filter until date"),
    status: DeadlineStatus | None = Query(None, description="Filter by status"),
    process_id: str | None = Query(None, description="Filter by process ID"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: str = Depends(get_user_id),
):
    """List deadlines for the current user."""
    params = DeadlineListParams(
        start_date=start_date,
        end_date=end_date,
        status=status,
        process_id=process_id,
        limit=limit,
        offset=offset,
    )
    (
        deadlines,
        total,
        today_count,
        week_count,
        overdue_count,
    ) = await deadlines_service.list_deadlines(user_id, params)
    return DeadlineListResponse(
        deadlines=deadlines,
        total=total,
        today_count=today_count,
        week_count=week_count,
        overdue_count=overdue_count,
    )


@router.get("/{deadline_id}", response_model=DeadlineResponse)
async def get_deadline(
    deadline_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single deadline by ID."""
    deadline = await deadlines_service.get_deadline(user_id, deadline_id)
    if not deadline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deadline not found",
        )
    return deadline
