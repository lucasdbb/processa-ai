from enum import Enum

from pydantic import BaseModel


class FunctionalityType(str, Enum):
    AI = "ai"
    CALCULATOR = "calculator"
    OFFICE = "office"
    BLOG = "blog"


class UploadUrlRequest(BaseModel):
    filename: str
    user_id: str
    functionality: FunctionalityType
    client_id: str | None = None
    expires_in: int = 3600


class UploadUrlResponse(BaseModel):
    upload_url: str
    storage_path: str
    bucket: str
    job_uuid: str
