from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GeminiPromptConfig:
    """Configuration for a Gemini-based document analysis pipeline.

    Uses Gemini's native PDF processing (no OCR step needed).
    System instruction is defined in a separate module.
    """

    # System instruction for Gemini
    system_instruction: str

    # User-facing prompt sent alongside the PDF
    user_prompt: str = "Analise este documento."

    # Progress messages
    progress_analysis_start: str = "Iniciando análise do documento"
    progress_analysis_done: str = "Análise concluída, finalizando"
