"""Timeline/Andamentos schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


TimelineEventType = Literal[
    "creation",      # Processo criado
    "update",        # Processo atualizado
    "deadline",      # Prazo criado/vencido
    "document",      # Documento anexado
    "note",          # Anotacao adicionada
    "status_change", # Mudanca de status
    "hearing",       # Audiencia
    "petition",      # Peticao
    "decision",      # Decisao judicial
    "citation",      # Citacao
    "other",         # Outros
]


class TimelineEventCreate(BaseModel):
    """Schema for creating a timeline event."""

    process_id: UUID
    event_type: TimelineEventType
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    event_date: datetime | None = None  # Se None, usa created_at
    metadata: dict | None = None  # Dados extras (ex: document_id, deadline_id)


class TimelineEventUpdate(BaseModel):
    """Schema for updating a timeline event."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    event_date: datetime | None = None
    metadata: dict | None = None


class TimelineEventResponse(BaseModel):
    """Schema for timeline event response."""

    id: UUID
    user_id: UUID
    process_id: UUID
    event_type: TimelineEventType
    title: str
    description: str | None
    event_date: datetime
    metadata: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TimelineListResponse(BaseModel):
    """Schema for timeline list response."""

    events: list[TimelineEventResponse]
    total: int


class TimelineListParams(BaseModel):
    """Schema for timeline list parameters."""

    process_id: UUID | None = None
    event_type: TimelineEventType | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
