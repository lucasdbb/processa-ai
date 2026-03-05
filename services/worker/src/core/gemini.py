"""Google Gemini client for PDF analysis."""

import asyncio

from google import genai
from google.genai import types
from google.genai.types import Part

from src.core.config import settings
from src.core.logging import logger

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
) -> str:
    """Send PDF bytes directly to Gemini for analysis.

    No OCR step needed — Gemini reads the PDF natively.

    Args:
        pdf_bytes: Raw PDF file content.
        system_instruction: System prompt defining the analysis behavior.
        user_prompt: User-facing instruction for the analysis.

    Returns:
        The model's text response.

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

            logger.info(
                "Gemini analysis complete: %d characters (model=%s, attempt=%d)",
                len(text),
                model,
                attempt,
            )
            return text

        except Exception as e:
            last_error = e
            logger.warning("Gemini call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)

    raise RuntimeError(f"Gemini call failed after {MAX_RETRIES} attempts: {last_error}")
