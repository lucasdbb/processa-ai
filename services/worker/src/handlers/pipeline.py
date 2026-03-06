"""Reusable document analysis pipeline: OCR -> Analyze.

This replaces the n8n workflow calls with direct SDK calls.
Both CNIS and Process Summary flows use this same pipeline,
differing only in the stored prompt ID passed in.

Also provides a Gemini-based pipeline that sends PDFs via URL
directly (no OCR step needed).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from src.core.llm import response_create
from src.core.logging import logger
from src.core.ocr import extract_text_from_url
from src.core.progress import ProgressReporter
from src.core.token_usage import TokenUsage
from src.prompts import AnalysisPromptConfig, GeminiPromptConfig


@dataclass
class PipelineResult:
    """Result of the document analysis pipeline."""

    markdown: str
    structured_data: dict | None = field(default=None)
    token_usage: TokenUsage | None = field(default=None)


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
        variables["extracted_documents"] = (
            "\n\n".join(f"--- DOCUMENTO {i} ---\n{t}" for i, t in enumerate(extracted_texts, 1))
            if extracted_texts
            else ""
        )

    markdown = await response_create(
        prompt_id=prompt.prompt_id,
        prompt_version=prompt.prompt_version,
        variables=variables,
    )
    logger.info("Analysis complete: %d characters generated", len(markdown))

    if progress:
        await progress.report(95, prompt.progress_analysis_done)

    return PipelineResult(markdown=markdown)


async def run_gemini_pdf_analysis(
    *,
    pdf_bytes: bytes,
    prompt: GeminiPromptConfig,
    progress: ProgressReporter | None = None,
) -> PipelineResult:
    """Execute document analysis via Gemini sending PDF bytes directly.

    No OCR step — Gemini reads the PDF natively.
    The response is expected to be JSON (possibly wrapped in markdown code fences).

    Args:
        pdf_bytes: Raw PDF file content.
        prompt: Gemini prompt configuration with system instruction.
        progress: Optional progress reporter for real-time updates.

    Returns:
        PipelineResult with raw text and parsed structured_data.

    Raises:
        RuntimeError: If the Gemini call fails after retries.
    """
    return await run_gemini_multi_pdf_analysis(
        pdf_bytes_list=[pdf_bytes],
        prompt=prompt,
        progress=progress,
    )


async def run_gemini_multi_pdf_analysis(
    *,
    pdf_bytes_list: list[bytes],
    prompt: GeminiPromptConfig,
    progress: ProgressReporter | None = None,
) -> PipelineResult:
    """Execute document analysis via Gemini sending multiple PDF bytes directly.

    No OCR step — Gemini reads the PDFs natively in a single request.
    The response is expected to be JSON (possibly wrapped in markdown code fences).

    Args:
        pdf_bytes_list: List of raw PDF file contents.
        prompt: Gemini prompt configuration with system instruction.
        progress: Optional progress reporter for real-time updates.

    Returns:
        PipelineResult with raw text and parsed structured_data.

    Raises:
        RuntimeError: If the Gemini call fails after retries.
    """
    from src.core.gemini import analyze_multiple_pdfs

    if progress:
        await progress.report(10, prompt.progress_analysis_start)

    raw_text, token_usage = await analyze_multiple_pdfs(
        pdf_bytes_list=pdf_bytes_list,
        system_instruction=prompt.system_instruction,
        user_prompt=prompt.user_prompt,
    )
    logger.info("Gemini analysis complete: %d characters generated", len(raw_text))

    # Parse JSON from response (Gemini may wrap it in ```json ... ``` fences)
    structured_data = _parse_json_response(raw_text)

    if progress:
        await progress.report(95, prompt.progress_analysis_done)

    return PipelineResult(markdown=raw_text, structured_data=structured_data, token_usage=token_usage)


def _parse_json_response(text: str) -> dict | None:
    """Extract and parse JSON from Gemini response.

    Handles both raw JSON and JSON wrapped in markdown code fences.
    """
    cleaned = text.strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.index("\n") if "\n" in cleaned else len(cleaned)
        cleaned = cleaned[first_newline + 1 :]
        # Remove closing fence
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
        logger.warning("Gemini returned JSON but not an object: %s", type(data).__name__)
        return None
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse Gemini response as JSON: %s", e)
        return None
