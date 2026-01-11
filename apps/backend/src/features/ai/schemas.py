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


class AiToolResponse(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    locked: bool
    order: int
