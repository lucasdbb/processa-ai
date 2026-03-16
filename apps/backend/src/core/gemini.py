"""Google Gemini client for chat streaming."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from google import genai
from google.genai import types

from src.core.config import settings
from src.core.logging import logger

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def stream_chat(
    *,
    system_instruction: str,
    contents: list[types.Content],
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Stream a chat response from Gemini, yielding text chunks.

    Args:
        system_instruction: System prompt for the chat.
        contents: Conversation history as Gemini Content objects.
        model: Optional model override. Falls back to settings.GEMINI_CHAT_MODEL.

    Yields:
        Text chunks as they arrive from the model.

    Raises:
        RuntimeError: If the Gemini call fails.
    """
    client = get_gemini_client()
    resolved_model = model or settings.GEMINI_CHAT_MODEL

    try:
        response = client.models.generate_content_stream(
            model=resolved_model,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            ),
            contents=contents,
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    except Exception as e:
        logger.exception("Gemini chat streaming failed (model=%s)", resolved_model)
        raise RuntimeError(f"Gemini chat failed: {e}") from e
