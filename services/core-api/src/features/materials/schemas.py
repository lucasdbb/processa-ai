from typing import Literal

from pydantic import BaseModel

MaterialMimeType = Literal["pdf", "xls", "xlsx", "xlsm", "docx", "csv"]


class MaterialListItem(BaseModel):
    slug: str
    title: str
    description: str | None = None
    group: str
    mime_type: MaterialMimeType


class MaterialAdminListItem(BaseModel):
    id: str
    slug: str
    title: str
    description: str | None = None
    group: str
    storage_bucket: str
    storage_path: str
    filename: str
    mime_type: MaterialMimeType
    is_published: bool
    created_at: str
    updated_at: str
