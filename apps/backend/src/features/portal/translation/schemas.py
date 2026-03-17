"""Schemas for the async translation pipeline."""

from pydantic import BaseModel


class TimelineTranslation(BaseModel):
    id: str
    timeline_event_id: str
    summary: str
    explanation: str
    action_required: str
    next_step: str | None
    sentiment: str  # positive | neutral | negative | urgent
    process_phase: str | None
    process_phase_progress: int | None
    model: str


class TranslationJobPayload(BaseModel):
    timeline_event_id: str
    event_type: str
    title: str
    description: str | None
    process_type: str | None
    process_number: str | None
