from pydantic import BaseModel


class CnisAnalysisResponse(BaseModel):
    text: str


class MarkdownToPdfRequest(BaseModel):
    markdown: str
    filename: str | None = None


class SignedPdfResponse(BaseModel):
    download_url: str
    expires_in: int
    document_id: str
    storage_path: str
    pipeline_version: str


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: str
