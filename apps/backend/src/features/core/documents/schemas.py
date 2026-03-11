from pydantic import BaseModel


class DocumentDownloadResponse(BaseModel):
    document_id: str
    download_url: str
    expires_in: int
    filename: str
