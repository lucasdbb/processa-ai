"""Google Gemini client for PDF and audio analysis."""

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
    model: str | None = None,
) -> tuple[str, TokenUsage | None]:
    """Send PDF bytes directly to Gemini for analysis.

    No OCR step needed — Gemini reads the PDF natively.

    Args:
        pdf_bytes: Raw PDF file content.
        system_instruction: System prompt defining the analysis behavior.
        user_prompt: User-facing instruction for the analysis.
        model: Optional model override. Falls back to settings.GEMINI_MODEL.

    Returns:
        Tuple of (text response, token usage or None).

    Raises:
        RuntimeError: If the call fails after all retries.
    """
    return await analyze_multiple_pdfs(
        pdf_bytes_list=[pdf_bytes],
        system_instruction=system_instruction,
        user_prompt=user_prompt,
        model=model,
    )


async def analyze_multiple_pdfs(
    *,
    pdf_bytes_list: list[bytes],
    system_instruction: str,
    user_prompt: str = "Analise estes documentos.",
    model: str | None = None,
) -> tuple[str, TokenUsage | None]:
    """Send multiple PDF bytes directly to Gemini for analysis.

    No OCR step needed — Gemini reads the PDFs natively.
    All PDFs are sent in a single request as separate Parts.

    Args:
        pdf_bytes_list: List of raw PDF file contents.
        system_instruction: System prompt defining the analysis behavior.
        user_prompt: User-facing instruction for the analysis.
        model: Optional model override. Falls back to settings.GEMINI_MODEL.

    Returns:
        Tuple of (text response, token usage or None).

    Raises:
        RuntimeError: If the call fails after all retries.
    """
    client = get_gemini_client()
    model = model or settings.GEMINI_MODEL
    last_error: Exception | None = None

    # Build contents: one Part per PDF, then the user prompt text
    contents = [
        Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
        for pdf_bytes in pdf_bytes_list
    ]
    contents.append(user_prompt)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
                contents=contents,
            )

            text = (response.text or "").strip()
            if not text:
                raise ValueError("Resposta vazia do Gemini")

            token_usage: TokenUsage | None = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                token_usage = token_usage_from_gemini(response.usage_metadata, model=model)
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


async def analyze_audio(
    *,
    audio_bytes: bytes,
    mime_type: str,
    system_instruction: str,
    user_prompt: str = "Transcreva este áudio.",
    model: str | None = None,
) -> tuple[str, TokenUsage | None]:
    """Send audio bytes directly to Gemini for transcription.

    Gemini natively supports audio input via Part.from_bytes.

    Args:
        audio_bytes: Raw audio file content.
        mime_type: MIME type of the audio (e.g. "audio/mpeg", "audio/wav").
        system_instruction: System prompt defining the transcription behavior.
        user_prompt: User-facing instruction for the transcription.
        model: Optional model override. Falls back to settings.GEMINI_MODEL.

    Returns:
        Tuple of (text response, token usage or None).

    Raises:
        RuntimeError: If the call fails after all retries.
    """
    client = get_gemini_client()
    model = model or settings.GEMINI_MODEL
    last_error: Exception | None = None

    contents = [
        Part.from_bytes(data=audio_bytes, mime_type=mime_type),
        user_prompt,
    ]

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
                contents=contents,
            )

            text = (response.text or "").strip()
            if not text:
                raise ValueError("Resposta vazia do Gemini")

            token_usage: TokenUsage | None = None
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                token_usage = token_usage_from_gemini(response.usage_metadata, model=model)
                logger.info(
                    "Gemini token usage: prompt=%d, completion=%d, total=%d, cost=$%.4f",
                    token_usage.prompt_tokens,
                    token_usage.completion_tokens,
                    token_usage.total_tokens,
                    token_usage.cost_usd,
                )

            logger.info(
                "Gemini audio transcription complete: %d characters (model=%s, attempt=%d)",
                len(text),
                model,
                attempt,
            )
            return text, token_usage

        except Exception as e:
            last_error = e
            logger.warning("Gemini audio call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)

    raise RuntimeError(f"Gemini audio call failed after {MAX_RETRIES} attempts: {last_error}")


async def generate_text(
    *,
    system_instruction: str,
    user_prompt: str,
    model: str | None = None,
    response_mime_type: str = "application/json",
) -> str:
    """Call Gemini with a text-only prompt (no PDF).

    Returns the raw text response.
    Raises RuntimeError on failure after all retries.
    """
    client = get_gemini_client()
    model = model or settings.GEMINI_ENRICHMENT_MODEL
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type=response_mime_type,
                ),
                contents=user_prompt,
            )
            text = (response.text or "").strip()
            if not text:
                raise ValueError("Resposta vazia do Gemini")
            return text
        except Exception as e:
            last_error = e
            logger.warning(
                "Gemini text call failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)

    raise RuntimeError(f"Gemini text call failed after {MAX_RETRIES} attempts: {last_error}")
