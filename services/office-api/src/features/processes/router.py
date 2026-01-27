from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.dependencies import get_user_id, verify_internal_token
from src.features.processes.schemas import (
    ProcessListParams,
    ProcessListResponse,
    ProcessResponse,
    ProcessStatus,
)
from src.features.processes.service import processes_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=ProcessListResponse)
async def list_processes(
    search: str | None = Query(None, description="Search by number, type, client or defendant"),
    status: ProcessStatus | None = Query(None, description="Filter by status"),
    client_id: str | None = Query(None, description="Filter by client ID"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: str = Depends(get_user_id),
):
    """List processes for the current user."""
    params = ProcessListParams(
        search=search,
        status=status,
        client_id=client_id,
        limit=limit,
        offset=offset,
    )
    processes, total = await processes_service.list_processes(user_id, params)
    return ProcessListResponse(processes=processes, total=total)


@router.get("/{process_id}", response_model=ProcessResponse)
async def get_process(
    process_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single process by ID."""
    process = await processes_service.get_process(user_id, process_id)
    if not process:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process not found",
        )
    return process
