"""Notes/Anotacoes router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.office.notes.schemas import (
    NoteCreate,
    NoteListParams,
    NoteListResponse,
    NoteResponse,
    NoteType,
    NoteUpdate,
)
from src.features.office.notes.service import notes_service

router = APIRouter(
    dependencies=[Depends(verify_internal_token)],
)


@router.get("", response_model=NoteListResponse)
async def list_notes(
    client_id: UUID | None = Query(None, description="Filter by client ID"),
    process_id: UUID | None = Query(None, description="Filter by process ID"),
    note_type: NoteType | None = Query(None, description="Filter by note type"),
    search: str | None = Query(None, description="Search in title and content"),
    pinned_only: bool = Query(False, description="Show only pinned notes"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Skip results"),
    user_id: UUID = Depends(get_user_id),
):
    """List notes for the current user."""
    params = NoteListParams(
        client_id=client_id,
        process_id=process_id,
        note_type=note_type,
        search=search,
        pinned_only=pinned_only,
        limit=limit,
        offset=offset,
    )
    notes, total = await notes_service.list_notes(user_id, params)
    return NoteListResponse(notes=notes, total=total)


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Get a single note by ID."""
    note = await notes_service.get_note(user_id, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note


@router.post("", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    data: NoteCreate,
    user_id: UUID = Depends(get_user_id),
):
    """Create a new note."""
    return await notes_service.create_note(user_id, data)


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    data: NoteUpdate,
    user_id: UUID = Depends(get_user_id),
):
    """Update an existing note."""
    note = await notes_service.update_note(user_id, note_id, data)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note


@router.post("/{note_id}/toggle-pin", response_model=NoteResponse)
async def toggle_note_pin(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Toggle the pinned status of a note."""
    note = await notes_service.toggle_pin(user_id, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
):
    """Delete a note."""
    deleted = await notes_service.delete_note(user_id, note_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
