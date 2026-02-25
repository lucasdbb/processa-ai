"""Schemas for the client portal (read-only views for office clients)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Portal identity
# ---------------------------------------------------------------------------


class PortalMeResponse(BaseModel):
    """Identity and context for the logged-in portal client."""

    client_id: UUID
    client_name: str
    client_email: str | None
    lawyer_name: str
    # portal status
    portal_status: str
    portal_invited_at: datetime | None


# ---------------------------------------------------------------------------
# Processes
# ---------------------------------------------------------------------------


class PortalProcessStatus(BaseModel):
    raw: str
    label: str  # human-readable Portuguese label
    color: str  # tailwind color token for the badge


class PortalTimelineEvent(BaseModel):
    id: UUID
    title: str
    description: str | None
    event_date: datetime
    event_type: str


class PortalProcessSummary(BaseModel):
    id: UUID
    process_number: str
    type: str
    court: str | None
    status: PortalProcessStatus
    value: float | None
    next_deadline: str | None
    recent_events: list[PortalTimelineEvent] = []


class PortalProcessListResponse(BaseModel):
    processes: list[PortalProcessSummary]
    total: int


# ---------------------------------------------------------------------------
# Events / Agenda
# ---------------------------------------------------------------------------


class PortalEvent(BaseModel):
    id: UUID
    title: str
    description: str | None
    start_at: datetime
    event_type: str  # "audiencia" | "prazo" | "reuniao"
    process_number: str | None
    process_id: UUID | None
    is_urgent: bool  # True if within the next 7 days


class PortalEventsResponse(BaseModel):
    upcoming: list[PortalEvent]
    past: list[PortalEvent]


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------


class PortalDocument(BaseModel):
    id: UUID
    name: str
    type: str
    file_size: int | None
    mime_type: str | None
    process_number: str | None
    created_at: datetime


class PortalDocumentsResponse(BaseModel):
    documents: list[PortalDocument]
    total: int


class PortalDocumentDownloadResponse(BaseModel):
    url: str
    expires_in: int  # seconds


# ---------------------------------------------------------------------------
# Finances
# ---------------------------------------------------------------------------


class PortalFee(BaseModel):
    id: UUID
    description: str
    fee_type: str
    amount: float
    paid_amount: float
    status: str  # pending | paid | overdue | cancelled
    due_date: date | None
    paid_at: date | None
    process_number: str | None


class PortalFinancesSummary(BaseModel):
    total_amount: float
    total_paid: float
    total_pending: float
    total_overdue: float


class PortalFinancesResponse(BaseModel):
    summary: PortalFinancesSummary
    fees: list[PortalFee]


# ---------------------------------------------------------------------------
# Invite (used by the lawyer-facing endpoint)
# ---------------------------------------------------------------------------


class InviteClientResponse(BaseModel):
    message: str
    portal_status: str
    portal_invited_at: datetime | None


class RevokePortalResponse(BaseModel):
    message: str
    portal_status: str
