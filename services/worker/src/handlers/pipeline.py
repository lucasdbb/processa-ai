"""Reusable document analysis pipeline: OCR -> Analyze -> Audit.

This replaces the n8n workflow calls with direct SDK calls.
Both CNIS and Process Summary flows use this same pipeline,
differing only in the prompt configuration passed in.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from src.core.llm import chat_completion, chat_completion_json
from src.core.logging import logger
from src.core.ocr import extract_text_from_url
from src.core.progress import ProgressReporter
from src.handlers.prompts import AnalysisPromptConfig


@dataclass
class PipelineResult:
    """Result of the document analysis pipeline."""

    markdown: str
    audit_score: float
    approved: bool
    audit_metadata: dict[str, Any]


async def run_document_analysis(
    *,
    pdf_url: str,
    prompt: AnalysisPromptConfig,
    progress: ProgressReporter | None = None,
) -> PipelineResult:
    """Execute the full document analysis pipeline.

    Steps:
        1. OCR - Extract text from PDF (Mistral)
        2. Analyze - Generate report/summary (OpenAI)
        3. Audit - Score quality and approve/reject (OpenAI)

    Args:
        pdf_url: Signed URL to the PDF document.
        prompt: Prompt configuration for the specific analysis type.
        progress: Optional progress reporter for real-time updates.

    Returns:
        PipelineResult with markdown, audit score, and metadata.

    Raises:
        RuntimeError: If any pipeline step fails after retries.
    """
    # --- Step 1: OCR ---
    if progress:
        await progress.report(10, prompt.progress_ocr_start)

    extracted_text = await extract_text_from_url(pdf_url)
    logger.info("OCR complete: %d characters extracted", len(extracted_text))

    # --- Step 2: Analyze ---
    if progress:
        await progress.report(40, prompt.progress_ocr_done)

    markdown = await chat_completion(
        system=prompt.analysis_system,
        user=prompt.analysis_user_template.format(extracted_text=extracted_text),
        temperature=prompt.analysis_temperature,
    )
    logger.info("Analysis complete: %d characters generated", len(markdown))

    # --- Step 3: Audit ---
    if progress:
        await progress.report(70, prompt.progress_analysis_done)

    audit = await chat_completion_json(
        system=prompt.audit_system,
        user=prompt.audit_user_template.format(
            extracted_text=extracted_text,
            generated_report=markdown,
        ),
        temperature=prompt.audit_temperature,
    )

    approved = audit.get("aprovado") is True
    score = _parse_score(audit.get("media"))

    if approved and progress:
        await progress.report(95, prompt.progress_audit_approved)

    logger.info("Audit complete: score=%.1f, approved=%s", score, approved)

    return PipelineResult(
        markdown=markdown,
        audit_score=score,
        approved=approved,
        audit_metadata=audit,
    )


def _parse_score(value: Any) -> float:
    """Safely parse audit score to float."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0
