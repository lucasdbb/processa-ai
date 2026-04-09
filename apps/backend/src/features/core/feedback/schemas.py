from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

FeedbackType = Literal["suggestion", "bug", "other"]
FeedbackStatus = Literal["new", "in_progress", "done", "archived"]
FeedbackCategory = Literal["ux", "bug_report", "performance", "feature_request", "content"]


class FeedbackCreate(BaseModel):
    type: FeedbackType
    content: str
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    category: Optional[FeedbackCategory] = None
    adaptive_answer: Optional[str] = None
    path: Optional[str] = None
    user_agent: Optional[str] = None

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        content = value.strip()
        if not content:
            raise ValueError("content cannot be empty")
        return content

    @field_validator("adaptive_answer")
    @classmethod
    def normalize_adaptive_answer(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class FeedbackUpdate(BaseModel):
    status: FeedbackStatus


class FeedbackResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    reference_code: str
    type: FeedbackType
    content: str
    rating: Optional[int]
    category: Optional[FeedbackCategory]
    adaptive_answer: Optional[str]
    path: Optional[str]
    user_agent: Optional[str]
    status: FeedbackStatus
    created_at: datetime
    updated_at: datetime

    # Optional user details
    user_email: Optional[str] = None
    user_name: Optional[str] = None


class FeedbackListResponse(BaseModel):
    items: list[FeedbackResponse]
    total: int
