"""Office API proxy router - Routes requests to the Office API microservice."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request

from src.core.auth import get_current_user
from src.core.config import settings
from src.core.proxy import proxy_request

router = APIRouter()


# === Clients ===


@router.get("/clients")
async def list_clients(
    search: str | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List clients for the current user."""
    params = {"limit": limit, "offset": offset}
    if search:
        params["search"] = search
    if status:
        params["status"] = status

    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/clients",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    """Get a single client by ID."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/clients/{client_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Processes ===


@router.get("/processes")
async def list_processes(
    search: str | None = Query(None),
    status: str | None = Query(None),
    client_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List processes for the current user."""
    params = {"limit": limit, "offset": offset}
    if search:
        params["search"] = search
    if status:
        params["status"] = status
    if client_id:
        params["client_id"] = client_id

    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/processes",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.get("/processes/{process_id}")
async def get_process(process_id: str, user=Depends(get_current_user)):
    """Get a single process by ID."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/processes/{process_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Deadlines ===


@router.get("/deadlines")
async def list_deadlines(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    status: str | None = Query(None),
    process_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List deadlines for the current user."""
    params = {"limit": limit, "offset": offset}
    if start_date:
        params["start_date"] = start_date.isoformat()
    if end_date:
        params["end_date"] = end_date.isoformat()
    if status:
        params["status"] = status
    if process_id:
        params["process_id"] = process_id

    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/deadlines",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.get("/deadlines/{deadline_id}")
async def get_deadline(deadline_id: str, user=Depends(get_current_user)):
    """Get a single deadline by ID."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/deadlines/{deadline_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Documents ===


@router.get("/documents")
async def list_documents(
    search: str | None = Query(None),
    type: str | None = Query(None),
    status: str | None = Query(None),
    process_id: str | None = Query(None),
    client_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List documents for the current user."""
    params = {"limit": limit, "offset": offset}
    if search:
        params["search"] = search
    if type:
        params["type"] = type
    if status:
        params["status"] = status
    if process_id:
        params["process_id"] = process_id
    if client_id:
        params["client_id"] = client_id

    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/documents",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.get("/documents/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    """Get a single document by ID."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/documents/{document_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Calendar Events ===


@router.get("/calendar/events")
async def list_events(
    start: datetime = Query(...),
    end: datetime = Query(...),
    calendar_id: str | None = Query(None),
    event_type: str | None = Query(None),
    user=Depends(get_current_user),
):
    """List calendar events within a date range."""
    params = {"start": start.isoformat(), "end": end.isoformat()}
    if calendar_id:
        params["calendar_id"] = calendar_id
    if event_type:
        params["event_type"] = event_type

    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/calendar/events",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.post("/calendar/events")
async def create_event(request: Request, user=Depends(get_current_user)):
    """Create a new calendar event."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/calendar/events",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.get("/calendar/events/{event_id}")
async def get_event(event_id: str, user=Depends(get_current_user)):
    """Get a single calendar event by ID."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/calendar/events/{event_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.put("/calendar/events/{event_id}")
async def update_event(event_id: str, request: Request, user=Depends(get_current_user)):
    """Update a calendar event."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="PUT",
        path=f"/api/v1/calendar/events/{event_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.delete("/calendar/events/{event_id}")
async def delete_event(event_id: str, user=Depends(get_current_user)):
    """Delete a calendar event."""
    return await proxy_request(
        base_url=settings.OFFICE_API_BASE_URL,
        internal_token=settings.OFFICE_API_INTERNAL_TOKEN,
        method="DELETE",
        path=f"/api/v1/calendar/events/{event_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )
