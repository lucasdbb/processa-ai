from pydantic import BaseModel


class CnisAnalysisResponse(BaseModel):
    text: str


class MarkdownToPdfRequest(BaseModel):
    markdown: str
    filename: str | None = None


class AiToolResponse(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    locked: bool
    order: int
