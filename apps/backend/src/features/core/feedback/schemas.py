from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    type: str
    content: str
    path: Optional[str] = None
    user_agent: Optional[str] = None


class FeedbackUpdate(BaseModel):
    status: str


class FeedbackResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    type: str
    content: str
    path: Optional[str]
    user_agent: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    # Optional user details
    user_email: Optional[str] = None
    user_name: Optional[str] = None


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
