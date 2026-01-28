from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.clients.schemas import (
    ClientListParams,
    ClientListResponse,
    ClientResponse,
    ClientStatus,
)
from src.features.office.clients.service import clients_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=ClientListResponse)
async def list_clients(
    search: str | None = Query(None, description="Search by name, CPF or email"),
    status: ClientStatus | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: str = Depends(get_user_id),
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


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single client by ID."""
    client = await clients_service.get_client(user_id, client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return client
