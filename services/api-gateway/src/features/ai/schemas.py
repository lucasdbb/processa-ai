"""Schemas for AI endpoints"""
from pydantic import BaseModel


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    result: dict | None = None
    error: str | None = None


class AnalysisHistoryResponse(BaseModel):
    items: list[dict]
    total: int


class DocumentDownloadResponse(BaseModel):
    document_id: str
    download_url: str
    expires_in: int
    filename: str
