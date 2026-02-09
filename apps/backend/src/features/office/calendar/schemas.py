from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# === Event Types ===
EventType = Literal["audiencia", "prazo", "reuniao", "other"]
EventStatus = Literal["confirmed", "tentative", "cancelled"]
EventSource = Literal["local", "google"]
SyncStatus = Literal["synced", "pending_sync", "conflict"]
DeadlinePriority = Literal["low", "medium", "high", "urgent"]
DeadlineStatusType = Literal["pending", "completed", "cancelled"]


# === Event Schemas ===
class EventCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    location: str | None = None
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    event_type: EventType = "other"
    calendar_id: str | None = None
    processo_id: str | None = None
    cliente_id: str | None = None
    color: str | None = None
    reminder_minutes: list[int] = Field(default_factory=lambda: [15, 60])
    priority: DeadlinePriority | None = None
    deadline_status: DeadlineStatusType | None = None
    reminder_days_before: int | None = Field(None, ge=0, le=30)


class EventUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    location: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    event_type: EventType | None = None
    processo_id: str | None = None
    cliente_id: str | None = None
    color: str | None = None
    reminder_minutes: list[int] | None = None
    priority: DeadlinePriority | None = None
    deadline_status: DeadlineStatusType | None = None
    reminder_days_before: int | None = Field(None, ge=0, le=30)


class EventResponse(BaseModel):
    id: str
    user_id: str
    calendar_id: str | None
    google_event_id: str | None
    title: str
    description: str | None
    location: str | None
    start_at: datetime
    end_at: datetime
    all_day: bool
    event_type: EventType
    status: EventStatus
    processo_id: str | None
    cliente_id: str | None
    color: str | None
    reminder_minutes: list[int]
    source: EventSource
    sync_status: SyncStatus
    priority: str | None = None
    deadline_status: str | None = None
    completed_at: datetime | None = None
    reminder_days_before: int | None = None
    created_at: datetime
    updated_at: datetime


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int


class EventListParams(BaseModel):
    start: date
    end: date
    calendar_id: str | None = None
    event_type: EventType | None = None
    priority: DeadlinePriority | None = None
    deadline_status: DeadlineStatusType | None = None


# === Calendar Schemas ===
class CalendarResponse(BaseModel):
    id: str
    user_id: str
    google_calendar_id: str | None
    name: str
    color: str | None
    is_primary: bool
    is_synced: bool
    last_synced_at: datetime | None
    created_at: datetime


class CalendarListResponse(BaseModel):
    calendars: list[CalendarResponse]


class CalendarUpdateRequest(BaseModel):
    is_synced: bool | None = None
    color: str | None = None


# === OAuth Schemas ===
class OAuthConnectResponse(BaseModel):
    auth_url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthStatusResponse(BaseModel):
    connected: bool
    email: str | None = None
    expires_at: datetime | None = None
    scopes: list[str] = Field(default_factory=list)


# === Sync Schemas ===
class SyncResponse(BaseModel):
    success: bool
    events_added: int = 0
    events_updated: int = 0
    events_deleted: int = 0
    message: str | None = None
