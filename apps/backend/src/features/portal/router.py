"""Portal router — read-only endpoints for office clients and lawyer preview."""

from fastapi import APIRouter, Depends, Query

from src.core.auth import CurrentUser, get_current_user, verify_internal_token
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


@router.get("/me", response_model=PortalMeResponse)
async def portal_me(
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """Return identity and context for the logged-in portal client or lawyer preview."""
    return await portal_service.get_me(user.id, user.role, preview_client_id)


@router.get("/processes", response_model=PortalProcessListResponse)
async def portal_processes(
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """List all processes for the portal client or lawyer preview."""
    return await portal_service.get_processes(user.id, user.role, preview_client_id)


@router.get("/events", response_model=PortalEventsResponse)
async def portal_events(
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """List upcoming and past events (hearings, deadlines, meetings) for the portal client or lawyer preview."""
    return await portal_service.get_events(user.id, user.role, preview_client_id)


@router.get("/documents", response_model=PortalDocumentsResponse)
async def portal_documents(
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """List documents shared with the portal client or lawyer preview."""
    return await portal_service.get_documents(user.id, user.role, preview_client_id)


@router.get("/documents/{document_id}/download", response_model=PortalDocumentDownloadResponse)
async def portal_document_download(
    document_id: str,
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """Generate a short-lived signed download URL for a document."""
    return await portal_service.get_document_download_url(
        user.id,
        user.role,
        document_id,
        preview_client_id,
    )


@router.get("/finances", response_model=PortalFinancesResponse)
async def portal_finances(
    preview_client_id: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
):
    """Return fee summary and list for the portal client or lawyer preview."""
    return await portal_service.get_finances(user.id, user.role, preview_client_id)
