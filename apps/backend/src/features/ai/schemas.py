from pydantic import BaseModel, Field


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


class AiToolTemplateResponse(BaseModel):
    label: str
    prompt: str


class AiToolResponse(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    locked: bool
    order: int
    templates: list[AiToolTemplateResponse] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    response: str
