from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from src.core.auth import get_user_id, verify_internal_token
from src.core.config import settings
from src.features.office.calendar.google_sync import google_sync_service
from src.features.office.calendar.schemas import (
    EventCreateRequest,
    EventListParams,
    EventListResponse,
    EventResponse,
    EventType,
    EventUpdateRequest,
    OAuthConnectResponse,
    OAuthStatusResponse,
    SyncResponse,
)
from src.features.office.calendar.service import calendar_service

router = APIRouter()

# Internal-token-protected dependency for reuse
_auth = [Depends(verify_internal_token)]


# === Events Endpoints ===


@router.get("/events", response_model=EventListResponse, dependencies=_auth)
async def list_events(
    start: date = Query(..., description="Start date for event range (YYYY-MM-DD)"),
    end: date = Query(..., description="End date for event range (YYYY-MM-DD)"),
    calendar_id: str | None = Query(None, description="Filter by calendar ID"),
    event_type: EventType | None = Query(None, description="Filter by event type"),
    priority: str | None = Query(None, description="Filter by priority"),
    deadline_status: str | None = Query(None, description="Filter by deadline status"),
    user_id: str = Depends(get_user_id),
):
    """List events within a date range."""
    params = EventListParams(
        start=start,
        end=end,
        calendar_id=calendar_id,
        event_type=event_type,
        priority=priority,
        deadline_status=deadline_status,
    )
    events, total = await calendar_service.list_events(user_id, params)
    return EventListResponse(events=events, total=total)


@router.post(
    "/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED, dependencies=_auth
)
async def create_event(
    data: EventCreateRequest,
    user_id: str = Depends(get_user_id),
):
    """Create a new event."""
    return await calendar_service.create_event(user_id, data)


@router.get("/events/{event_id}", response_model=EventResponse, dependencies=_auth)
async def get_event(
    event_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single event by ID."""
    return await calendar_service.get_event(user_id, event_id)


@router.put("/events/{event_id}", response_model=EventResponse, dependencies=_auth)
async def update_event(
    event_id: str,
    data: EventUpdateRequest,
    user_id: str = Depends(get_user_id),
):
    """Update an existing event."""
    return await calendar_service.update_event(user_id, event_id, data)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=_auth)
async def delete_event(
    event_id: str,
    user_id: str = Depends(get_user_id),
):
    """Delete an event."""
    await calendar_service.delete_event(user_id, event_id)
    return None


# === Google Calendar Integration Endpoints ===


@router.get("/google/connect", response_model=OAuthConnectResponse, dependencies=_auth)
async def connect_google_calendar(
    user_id: str = Depends(get_user_id),
):
    """Generate Google OAuth2 authorization URL."""
    result = await google_sync_service.get_auth_url(user_id)
    return OAuthConnectResponse(auth_url=result["auth_url"], state=result["state"])


@router.get("/google/callback")
async def google_calendar_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="Encrypted user_id"),
):
    """Handle Google OAuth2 callback. Redirects to frontend after processing."""
    try:
        result = await google_sync_service.handle_callback(code, state)

        if result.get("success"):
            redirect_url = f"{settings.FRONTEND_URL}/app/calendario?google_connected=true"
            return RedirectResponse(url=redirect_url)
        else:
            redirect_url = f"{settings.FRONTEND_URL}/app/calendario?google_connected=false"
            return RedirectResponse(url=redirect_url)

    except Exception as e:
        redirect_url = (
            f"{settings.FRONTEND_URL}/app/calendario?google_connected=false&error={str(e)}"
        )
        return RedirectResponse(url=redirect_url)


@router.get("/google/status", response_model=OAuthStatusResponse, dependencies=_auth)
async def get_google_connection_status(
    user_id: str = Depends(get_user_id),
):
    """Get Google Calendar connection status for current user."""
    status_info = await google_sync_service.get_connection_status(user_id)
    return OAuthStatusResponse(
        connected=status_info["connected"],
        email=status_info.get("email"),
        expires_at=status_info.get("expires_at"),
        scopes=status_info.get("scopes", []),
    )


@router.post("/google/sync", response_model=SyncResponse, dependencies=_auth)
async def sync_events_to_google(
    user_id: str = Depends(get_user_id),
):
    """Trigger one-way sync to push pending events to Google Calendar."""
    result = await google_sync_service.push_events_to_google(user_id)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=result.get("message", "Sync failed")
        )

    return SyncResponse(
        success=result["success"],
        events_added=result["events_added"],
        events_updated=result["events_updated"],
        events_deleted=result["events_deleted"],
        message=result.get("message"),
    )


@router.delete("/google/disconnect", status_code=status.HTTP_204_NO_CONTENT, dependencies=_auth)
async def disconnect_google_calendar(
    user_id: str = Depends(get_user_id),
):
    """Disconnect Google Calendar integration."""
    await google_sync_service.disconnect(user_id)
    return None
