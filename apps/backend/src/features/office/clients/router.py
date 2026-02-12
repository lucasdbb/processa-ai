from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.clients.schemas import (
    ClientCreate,
    ClientDetailResponse,
    ClientListParams,
    ClientListResponse,
    ClientResponse,
    ClientStatus,
    ClientUpdate,
)
from src.features.office.clients.service import clients_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=ClientListResponse)
async def list_clients(
    search: str | None = Query(None, description="Search by name/email/CPF"),
    status: ClientStatus | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List clients for the current user."""
    params = ClientListParams(
        search=search,
        status=status,
        limit=limit,
        offset=offset,
    )
    clients, total = await clients_service.list_clients(user_id, params)
    return ClientListResponse(clients=clients, total=total)


@router.get("/count")
async def count_clients(
    user_id: UUID = Depends(get_user_id),
):
    """Count active clients for the current user."""
    return await clients_service.count_clients(user_id)


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single client by ID."""
    client = await clients_service.get_client(user_id, client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


@router.get("/{client_id}/detail", response_model=ClientDetailResponse)
async def get_client_detail(
    client_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get aggregated client detail with processes, fees, and notes."""
    client = await clients_service.get_client_detail(user_id, client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new client."""
    return await clients_service.create_client(user_id, data)


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing client."""
    client = await clients_service.update_client(user_id, client_id, data)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a client."""
    deleted = await clients_service.delete_client(user_id, client_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
