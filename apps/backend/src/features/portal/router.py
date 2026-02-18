"""Portal router — read-only endpoints for office clients."""

from fastapi import APIRouter, Depends

from src.core.auth import get_current_user, CurrentUser, verify_internal_token
from src.features.portal.schemas import (
    PortalDocumentDownloadResponse,
    PortalDocumentsResponse,
    PortalEventsResponse,
    PortalFinancesResponse,
    PortalMeResponse,
    PortalProcessListResponse,
)
from src.features.portal.service import portal_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


def _require_portal_client(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Ensure the caller has the office_client role."""
    from fastapi import HTTPException, status as http_status
    if user.role != "office_client":
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Portal access only",
        )
    return user


@router.get("/me", response_model=PortalMeResponse)
async def portal_me(user: CurrentUser = Depends(_require_portal_client)):
    """Return identity and context for the logged-in portal client."""
    return await portal_service.get_me(user.id)


@router.get("/processes", response_model=PortalProcessListResponse)
async def portal_processes(user: CurrentUser = Depends(_require_portal_client)):
    """List all processes for the portal client."""
    return await portal_service.get_processes(user.id)


@router.get("/events", response_model=PortalEventsResponse)
async def portal_events(user: CurrentUser = Depends(_require_portal_client)):
    """List upcoming and past events (hearings, deadlines, meetings) for the portal client."""
    return await portal_service.get_events(user.id)


@router.get("/documents", response_model=PortalDocumentsResponse)
async def portal_documents(user: CurrentUser = Depends(_require_portal_client)):
    """List documents shared with the portal client."""
    return await portal_service.get_documents(user.id)


@router.get("/documents/{document_id}/download", response_model=PortalDocumentDownloadResponse)
async def portal_document_download(
    document_id: str,
    user: CurrentUser = Depends(_require_portal_client),
):
    """Generate a short-lived signed download URL for a document."""
    return await portal_service.get_document_download_url(user.id, document_id)


@router.get("/finances", response_model=PortalFinancesResponse)
async def portal_finances(user: CurrentUser = Depends(_require_portal_client)):
    """Return fee summary and list for the portal client."""
    return await portal_service.get_finances(user.id)
