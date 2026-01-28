from typing import Literal

from pydantic import BaseModel

MaterialMimeType = Literal[
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel.sheet.macroEnabled.12",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
]


class MaterialListItem(BaseModel):
    slug: str
    title: str
    description: str | None = None
    category: str
    mime_type: MaterialMimeType


class MaterialAdminListItem(BaseModel):
    id: str
    slug: str
    title: str
    description: str | None = None
    category: str
    storage_bucket: str
    storage_path: str
    filename: str
    mime_type: MaterialMimeType
    is_published: bool
    created_at: str
    updated_at: str
