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


async def run_multi_document_analysis(
    *,
    pdf_urls: list[str],
    prompt: AnalysisPromptConfig,
    progress: ProgressReporter | None = None,
    user_prompt: str | None = None,
) -> PipelineResult:
    """Execute analysis pipeline with multiple PDFs and optional user text.

    Steps:
        1. OCR - Extract text from each PDF (Mistral)
        2. Combine texts with delimiters (and user prompt if provided)
        3. Analyze - Generate report via stored OpenAI prompt

    Args:
        pdf_urls: Signed URLs to PDF documents.
        prompt: Prompt configuration with stored prompt ID.
        progress: Optional progress reporter for real-time updates.
        user_prompt: Optional user-provided text (e.g. case facts for labor claim).

    Returns:
        PipelineResult with markdown.
    """
    if not prompt.prompt_id:
        raise RuntimeError("prompt_id is required")

    # --- Step 1: OCR all documents ---
    if progress:
        await progress.report(10, prompt.progress_ocr_start)

    extracted_texts: list[str] = []
    total_docs = len(pdf_urls)

    for i, url in enumerate(pdf_urls):
        text = await extract_text_from_url(url)
        logger.info("OCR complete for document %d/%d: %d characters", i + 1, total_docs, len(text))
        extracted_texts.append(text)

        if progress and total_docs > 1:
            ocr_progress = 10 + int(30 * (i + 1) / total_docs)
            await progress.report(ocr_progress, f"Documento {i + 1}/{total_docs} processado")

    # --- Step 2: Combine texts ---
    if progress:
        await progress.report(40, prompt.progress_ocr_done)

    # Build combined text with clear delimiters
    parts: list[str] = []

    if user_prompt:
        parts.append(f"--- TEXTO DO USUÁRIO ---\n{user_prompt}")

    for i, text in enumerate(extracted_texts, 1):
        if total_docs > 1:
            parts.append(f"--- DOCUMENTO {i} ---\n{text}")
        else:
            parts.append(text)

    combined_text = "\n\n".join(parts)
    logger.info("Combined text: %d characters from %d sources", len(combined_text), len(parts))

    # --- Step 3: Analyze via stored prompt ---
    variables: dict[str, str] = {"extracted_text": combined_text}
    if user_prompt:
        variables["user_prompt"] = user_prompt
        variables["extracted_documents"] = "\n\n".join(
            f"--- DOCUMENTO {i} ---\n{t}" for i, t in enumerate(extracted_texts, 1)
        ) if extracted_texts else ""

    markdown = await response_create(
        prompt_id=prompt.prompt_id,
        prompt_version=prompt.prompt_version,
        variables=variables,
    )
    logger.info("Analysis complete: %d characters generated", len(markdown))

    if progress:
        await progress.report(95, prompt.progress_analysis_done)

    return PipelineResult(markdown=markdown)
