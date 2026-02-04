"""Notes/Anotacoes schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

NoteType = Literal[
    "general",  # Nota geral
    "meeting",  # Reunião com cliente
    "call",  # Ligação telefônica
    "email",  # Email trocado
    "task",  # Tarefa/lembrete
    "internal",  # Nota interna do escritório
    "strategy",  # Estratégia jurídica
    "research",  # Pesquisa/jurisprudência
    "other",  # Outros
]


class NoteCreate(BaseModel):
    """Schema for creating a new note."""

    client_id: UUID | None = None
    process_id: UUID | None = None
    note_type: NoteType = "general"
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    """Schema for updating an existing note."""

    note_type: NoteType | None = None
    title: str | None = None
    content: str | None = None
    is_pinned: bool | None = None


class NoteResponse(BaseModel):
    """Schema for note response."""

    id: UUID
    user_id: UUID
    client_id: UUID | None
    process_id: UUID | None
    note_type: NoteType
    title: str
    content: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime

    # Joined fields (optional, for list views)
    client_name: str | None = None
    process_number: str | None = None

    model_config = {"from_attributes": True}


class NoteListParams(BaseModel):
    """Parameters for listing notes."""

    client_id: UUID | None = None
    process_id: UUID | None = None
    note_type: NoteType | None = None
    search: str | None = None
    pinned_only: bool = False
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class NoteListResponse(BaseModel):
    """Response for listing notes."""

    notes: list[NoteResponse]
    total: int
