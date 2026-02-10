from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AnalysisPromptConfig:
    """Configuration for a document analysis + audit pipeline step."""

    # Analysis LLM call
    analysis_system: str
    analysis_user_template: str
    audit_system: str
    audit_user_template: str

    analysis_temperature: float = 0.2

    # Audit LLM call
    audit_temperature: float = 0.1

    # Progress messages
    progress_ocr_start: str = "Iniciando extração de texto"
    progress_ocr_done: str = "Texto extraído, iniciando análise"
    progress_analysis_done: str = "Análise concluída, auditando resultado"
    progress_audit_approved: str = "Auditoria aprovada, finalizando"
