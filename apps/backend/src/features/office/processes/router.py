from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.processes.schemas import (
    ProcessCreate,
    ProcessDetailResponse,
    ProcessListParams,
    ProcessListResponse,
    ProcessResponse,
    ProcessStatus,
    ProcessUpdate,
)
from src.features.office.processes.service import processes_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=ProcessListResponse)
async def list_processes(
    search: str | None = Query(None, description="Search by number, type, defendant or subject"),
    status: ProcessStatus | None = Query(None, description="Filter by status"),
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    court: str | None = Query(None, description="Filter by court"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List processes for the current user."""
    params = ProcessListParams(
        search=search,
        status=status,
        client_id=client_id,
        court=court,
        limit=limit,
        offset=offset,
    )
    processes, total = await processes_service.list_processes(user_id, params)
    return ProcessListResponse(processes=processes, total=total)


@router.get("/count")
async def count_processes(
    user_id: UUID = Depends(get_user_id),
):
    """Count active processes for the current user."""
    return await processes_service.count_processes(user_id)


@router.get("/{process_id}", response_model=ProcessResponse)
async def get_process(
    process_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single process by ID."""
    process = await processes_service.get_process(user_id, process_id)
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )
    return process


@router.get("/{process_id}/detail", response_model=ProcessDetailResponse)
async def get_process_detail(
    process_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get aggregated process detail with client, deadlines, timeline, and documents."""
    process = await processes_service.get_process_detail(user_id, process_id)
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )
    return process


@router.post("", response_model=ProcessResponse, status_code=status.HTTP_201_CREATED)
async def create_process(
    data: ProcessCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new process."""
    return await processes_service.create_process(user_id, data)


@router.put("/{process_id}", response_model=ProcessResponse)
async def update_process(
    process_id: UUID,
    data: ProcessUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing process."""
    process = await processes_service.update_process(user_id, process_id, data)
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )
    return process


@router.delete("/{process_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_process(
    process_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a process."""
    deleted = await processes_service.delete_process(user_id, process_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )
