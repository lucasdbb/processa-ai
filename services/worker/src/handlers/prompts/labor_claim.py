from src.handlers.prompts import AnalysisPromptConfig

LABOR_CLAIM_PROMPT = AnalysisPromptConfig(
    prompt_id="pmpt_PLACEHOLDER_LABOR_CLAIM",
    prompt_version="1",
    progress_ocr_start="Processando documentos de apoio",
    progress_ocr_done="Documentos processados, gerando reclamação trabalhista",
    progress_analysis_done="Reclamação gerada, finalizando",
)
