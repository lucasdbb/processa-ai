from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.documents.schemas import (
    DocumentConfirmUpload,
    DocumentCreate,
    DocumentListParams,
    DocumentListResponse,
    DocumentResponse,
    DocumentStatus,
    DocumentType,
    DocumentUpdate,
)
from src.features.office.documents.service import documents_service

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


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    data: DocumentCreate,
    user_id: str = Depends(get_user_id),
):
    """Create a new document."""
    return await documents_service.create_document(user_id, data)


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    data: DocumentUpdate,
    user_id: str = Depends(get_user_id),
):
    """Update an existing document."""
    document = await documents_service.update_document(user_id, document_id, data)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


@router.post("/confirm-upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def confirm_upload(
    data: DocumentConfirmUpload,
    user_id: str = Depends(get_user_id),
):
    """Create document record after file was uploaded via signed URL."""
    return await documents_service.create_document_from_upload(user_id, data)


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    user_id: str = Depends(get_user_id),
):
    """Get a signed download URL for a document."""
    document = await documents_service.get_document(user_id, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    if not document.file_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No file attached to this document",
        )

    # Generate signed URL without download parameter (let Supabase handle it)
    signed_url = await documents_service.get_download_url(
        document.file_url,
        filename=None,  # Don't add download parameter
    )

    return {
        "download_url": signed_url,
        "filename": document.name,
        "mime_type": document.mime_type,
    }


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    user_id: str = Depends(get_user_id),
):
    """Delete a document."""
    deleted = await documents_service.delete_document(user_id, document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
