"""Reusable document analysis pipeline: OCR -> Analyze.

This replaces the n8n workflow calls with direct SDK calls.
Both CNIS and Process Summary flows use this same pipeline,
differing only in the stored prompt ID passed in.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.core.llm import response_create
from src.core.logging import logger
from src.core.ocr import extract_text_from_url
from src.core.progress import ProgressReporter
from src.handlers.prompts import AnalysisPromptConfig


@dataclass
class PipelineResult:
    """Result of the document analysis pipeline."""

    markdown: str


async def run_document_analysis(
    *,
    pdf_url: str,
    prompt: AnalysisPromptConfig,
    progress: ProgressReporter | None = None,
) -> PipelineResult:
    """Execute the document analysis pipeline.

    Steps:
        1. OCR - Extract text from PDF (Mistral)
        2. Analyze - Generate report via stored OpenAI prompt

    Args:
        pdf_url: Signed URL to the PDF document.
        prompt: Prompt configuration with stored prompt ID.
        progress: Optional progress reporter for real-time updates.

    Returns:
        PipelineResult with markdown.

    Raises:
        RuntimeError: If any pipeline step fails after retries.
    """
    if not prompt.prompt_id:
        raise RuntimeError("prompt_id is required")

    # --- Step 1: OCR ---
    if progress:
        await progress.report(10, prompt.progress_ocr_start)

    extracted_text = await extract_text_from_url(pdf_url)
    logger.info("OCR complete: %d characters extracted", len(extracted_text))

    # --- Step 2: Analyze via stored prompt ---
    if progress:
        await progress.report(40, prompt.progress_ocr_done)

    markdown = await response_create(
        prompt_id=prompt.prompt_id,
        prompt_version=prompt.prompt_version,
        variables={"extracted_text": extracted_text},
    )
    logger.info("Analysis complete: %d characters generated", len(markdown))

    if progress:
        await progress.report(95, prompt.progress_analysis_done)

    return PipelineResult(markdown=markdown)
