from pydantic import BaseModel, ConfigDict


class CnisAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    file_url: str | None = None
    storage_path: str | None = None
    bucket: str | None = None
    job_uuid: str | None = None
    files: list[dict] | None = None  # [{bucket, storage_path, filename}]

    client_id: str | None = None
    functionality: str = "ai"
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


class ProcessSummaryRequest(BaseModel):
    """Request para análise de resumo de processo via URL."""

    model_config = ConfigDict(extra="forbid")

    file_url: str | None = None
    storage_path: str | None = None
    bucket: str | None = None
    job_uuid: str | None = None
    files: list[dict] | None = None  # [{bucket, storage_path, filename}]

    client_id: str | None = None
    functionality: str = "ai"
    store_pdf: bool = False
    store_input_pdf: bool = True
    signed_url_expires_in: int = 600


class AiToolResponse(BaseModel):
    """Response para uma ferramenta de IA disponível."""

    slug: str
    name: str
    description: str
    icon: str
    variant: str
    locked: bool
    order: int


class AiToolsListResponse(BaseModel):
    """Lista de ferramentas de IA disponíveis."""

    tools: list[AiToolResponse]


class LaborClaimUploadRequest(BaseModel):
    """Metadata for labor claim upload (files sent via multipart)."""

    model_config = ConfigDict(extra="forbid")

    prompt: str
    client_id: str | None = None
    functionality: str = "ai"
    store_pdf: bool = True
    signed_url_expires_in: int = 600


class BriefScannerRequest(BaseModel):
    """Request para análise de peça processual (scanner de peça)."""

    model_config = ConfigDict(extra="forbid")

    file_url: str | None = None
    storage_path: str | None = None
    bucket: str | None = None
    job_uuid: str | None = None
    files: list[dict] | None = None  # [{bucket, storage_path, filename}]

    client_id: str | None = None
    functionality: str = "ai"
    store_pdf: bool = True
    store_input_pdf: bool = True
    signed_url_expires_in: int = 600


class AudioTranscriptionRequest(BaseModel):
    """Request para transcrição de áudio com IA."""

    model_config = ConfigDict(extra="forbid")

    file_url: str | None = None
    storage_path: str | None = None
    bucket: str | None = None
    job_uuid: str | None = None
    files: list[dict] | None = None  # [{bucket, storage_path, filename}]

    client_id: str | None = None
    functionality: str = "ai"
    store_pdf: bool = False
    store_input_pdf: bool = False
    signed_url_expires_in: int = 600


class ChatRequest(BaseModel):
    message: str
    client_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    credits_consumed: int
