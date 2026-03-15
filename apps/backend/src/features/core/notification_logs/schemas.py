from datetime import datetime

from pydantic import BaseModel


class NotificationLogResponse(BaseModel):
    id: str
    user_id: str
    user_name: str | None = None
    user_email: str | None = None
    channel: str
    recipient: str
    notification_type: str
    subject: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class NotificationLogStats(BaseModel):
    total: int
    by_channel: dict[str, int]
    by_status: dict[str, int]
    last_24h: int
    last_7d: int
    failure_rate: float
