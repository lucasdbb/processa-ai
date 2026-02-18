from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AnalysisPromptConfig:
    """Configuration for a document analysis pipeline step.

    Uses stored prompts managed in the OpenAI dashboard.
    Model, temperature, and system prompt are configured there.
    """

    # Stored prompt reference
    prompt_id: str
    prompt_version: str | None = None

    # Progress messages
    progress_ocr_start: str = "Iniciando extração de texto"
    progress_ocr_done: str = "Texto extraído, iniciando análise"
    progress_analysis_done: str = "Análise concluída, finalizando"
