from typing import Literal

from pydantic import BaseModel

MaterialMimeType = Literal["pdf", "xls", "xlsx", "xlsm", "docx", "csv"]


class MaterialListItem(BaseModel):
    slug: str
    title: str
    description: str | None = None
    group: str
    mime_type: MaterialMimeType
