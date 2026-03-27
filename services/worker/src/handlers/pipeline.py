"""Reusable Gemini document analysis pipeline.

Executes analysis by sending one or many PDFs directly to Gemini,
returning the raw model response and parsed structured JSON.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.token_usage import TokenUsage
from src.prompts import GeminiPromptConfig


@dataclass
class PipelineResult:
    """Result of the document analysis pipeline."""

    markdown: str
    structured_data: dict | None = field(default=None)
    token_usage: TokenUsage | None = field(default=None)


async def run_gemini_pdf_analysis(
    *,
    pdf_bytes: bytes,
    prompt: GeminiPromptConfig,
    progress: ProgressReporter | None = None,
    model: str | None = None,
) -> PipelineResult:
    """Execute document analysis via Gemini sending PDF bytes directly.

    No OCR step — Gemini reads the PDF natively.
    The response is expected to be JSON (possibly wrapped in markdown code fences).

    Args:
        pdf_bytes: Raw PDF file content.
        prompt: Gemini prompt configuration with system instruction.
        progress: Optional progress reporter for real-time updates.
        model: Optional Gemini model override.

    Returns:
        PipelineResult with raw text and parsed structured_data.

    Raises:
        RuntimeError: If the Gemini call fails after retries.
    """
    return await run_gemini_multi_pdf_analysis(
        pdf_bytes_list=[pdf_bytes],
        prompt=prompt,
        progress=progress,
        model=model,
    )


async def run_gemini_multi_pdf_analysis(
    *,
    pdf_bytes_list: list[bytes],
    prompt: GeminiPromptConfig,
    progress: ProgressReporter | None = None,
    model: str | None = None,
) -> PipelineResult:
    """Execute document analysis via Gemini sending multiple PDF bytes directly.

    No OCR step — Gemini reads the PDFs natively in a single request.
    The response is expected to be JSON (possibly wrapped in markdown code fences).

    Args:
        pdf_bytes_list: List of raw PDF file contents.
        prompt: Gemini prompt configuration with system instruction.
        progress: Optional progress reporter for real-time updates.
        model: Optional Gemini model override.

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
        model=model,
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
