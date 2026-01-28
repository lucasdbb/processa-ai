from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocumentType = Literal["ai_analysis", "calculation", "petition", "contract", "other"]
DocumentStatus = Literal["draft", "final", "archived"]


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: DocumentType
    status: DocumentStatus
    file_url: str | None
    file_size: int | None
    mime_type: str | None
    process_id: str | None
    client_id: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int


class DocumentListParams(BaseModel):
    search: str | None = None
    type: DocumentType | None = None
    status: DocumentStatus | None = None
    process_id: str | None = None
    client_id: str | None = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
