from src.handlers.prompts import AnalysisPromptConfig

BRIEF_SCANNER_PROMPT = AnalysisPromptConfig(
    prompt_id="pmpt_PLACEHOLDER_BRIEF_SCANNER",
    prompt_version="1",
    progress_ocr_start="Extraindo texto da(s) peça(s) processual(is)",
    progress_ocr_done="Texto extraído, analisando argumentos e identificando fragilidades",
    progress_analysis_done="Análise concluída, finalizando relatório",
)
