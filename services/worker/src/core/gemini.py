"""Google Gemini client for PDF analysis."""

from __future__ import annotations

import asyncio

from google import genai
from google.genai import types
from google.genai.types import Part

from src.core.config import settings
from src.core.logging import logger
from src.core.token_usage import TokenUsage, token_usage_from_gemini

_client: genai.Client | None = None

MAX_RETRIES = 3
RETRY_DELAY_S = 3.0


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def analyze_pdf(
    *,
    pdf_bytes: bytes,
    system_instruction: str,
    user_prompt: str = "Analise este documento.",
) -> tuple[str, TokenUsage | None]:
    """Send PDF bytes directly to Gemini for analysis.

    No OCR step needed — Gemini reads the PDF natively.

    Args:
        pdf_bytes: Raw PDF file content.
        system_instruction: System prompt defining the analysis behavior.
        user_prompt: User-facing instruction for the analysis.

    Returns:
        Tuple of (text response, token usage or None).

    Raises:
        RuntimeError: If the call fails after all retries.
    """
    client = get_gemini_client()
    model = settings.GEMINI_MODEL
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=model,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
                contents=[
                    Part.from_bytes(
                        data=pdf_bytes,
                        mime_type="application/pdf",
                    ),
                    user_prompt,
                ],
            )

            text = (response.text or "").strip()
            if not text:
                raise ValueError("Resposta vazia do Gemini")

            token_usage: TokenUsage | None = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                token_usage = token_usage_from_gemini(response.usage_metadata)
                logger.info(
                    "Gemini token usage: prompt=%d, completion=%d, total=%d, cost=$%.4f",
                    token_usage.prompt_tokens,
                    token_usage.completion_tokens,
                    token_usage.total_tokens,
                    token_usage.cost_usd,
                )

            logger.info(
                "Gemini analysis complete: %d characters (model=%s, attempt=%d)",
                len(text),
                model,
                attempt,
            )
            return text, token_usage

        except Exception as e:
            last_error = e
            logger.warning("Gemini call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)

    raise RuntimeError(f"Gemini call failed after {MAX_RETRIES} attempts: {last_error}")
