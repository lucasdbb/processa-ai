from pydantic import BaseModel


class CnisAnalysisResponse(BaseModel):
    text: str


class AiToolResponse(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    locked: bool
    order: int
