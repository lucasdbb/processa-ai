from pydantic import BaseModel, ConfigDict


class CnisAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_url: str
    user_id: str
    client_id: str | None = None
    store_pdf: bool = False
    store_input_pdf: bool = True  # Sempre salvar input para histórico
    signed_url_expires_in: int = 600


class EnqueueJobResponse(BaseModel):
    job_id: str
    status: str = "queued"


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int = 0
    result: dict | None = None
    error: str | None = None


class JobProgressCallback(BaseModel):
    """Schema para callback de progresso do n8n."""

    job_id: str
    progress: int
    message: str | None = None


class CnisAnalysisResponse(BaseModel):
    model_config = ConfigDict(ser_json_bytes="base64")

    content: bytes
    audit_score: float | None = None
    download_url: str | None = None
    storage_path: str | None = None
    bucket: str | None = None


class DocumentResponse(BaseModel):
    id: str
    document_type: str  # 'input' ou 'output'
    filename: str
    size_bytes: int | None = None
    created_at: str
    download_url: str | None = None


class AnalysisHistoryItem(BaseModel):
    job_id: str
    status: str
    created_at: str
    finished_at: str | None = None
    input_document: DocumentResponse | None = None
    output_document: DocumentResponse | None = None
    audit_score: float | None = None


class AnalysisHistoryResponse(BaseModel):
    items: list[AnalysisHistoryItem]
    total: int


class DocumentDownloadResponse(BaseModel):
    document_id: str
    download_url: str
    expires_in: int
    filename: str
