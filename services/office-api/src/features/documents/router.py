from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.dependencies import get_user_id, verify_internal_token
from src.features.documents.schemas import (
    DocumentListParams,
    DocumentListResponse,
    DocumentResponse,
    DocumentStatus,
    DocumentType,
)
from src.features.documents.service import documents_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    search: str | None = Query(None, description="Search by name or description"),
    type: DocumentType | None = Query(None, description="Filter by document type"),
    status: DocumentStatus | None = Query(None, description="Filter by status"),
    process_id: str | None = Query(None, description="Filter by process ID"),
    client_id: str | None = Query(None, description="Filter by client ID"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: str = Depends(get_user_id),
):
    """List documents for the current user."""
    params = DocumentListParams(
        search=search,
        type=type,
        status=status,
        process_id=process_id,
        client_id=client_id,
        limit=limit,
        offset=offset,
    )
    documents, total = await documents_service.list_documents(user_id, params)
    return DocumentListResponse(documents=documents, total=total)


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a single document by ID."""
    document = await documents_service.get_document(user_id, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document
