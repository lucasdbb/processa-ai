"""OpenAI LLM client with retry logic."""

import asyncio
import json

from openai import AsyncOpenAI

from src.core.config import settings
from src.core.logging import logger

_client: AsyncOpenAI | None = None

MIN_RETRIES = 1
MAX_RETRIES = 3
RETRY_DELAY_S = 3.0


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def chat_completion(
    *,
    system: str,
    user: str,
    temperature: float = 0.2,
    json_mode: bool = False,
    max_retries: int = 2,
) -> str:
    """Call OpenAI chat completion with automatic retry.

    Returns the assistant's text response.
    Raises RuntimeError on failure after all retries.
    """
    client = get_openai_client()
    retries = min(max(max_retries, MIN_RETRIES), MAX_RETRIES)

    kwargs: dict = {
        "model": settings.LLM_MODEL,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = await client.chat.completions.create(**kwargs)
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise ValueError("Resposta vazia do LLM")
            return text
        except Exception as e:
            last_error = e
            logger.warning(
                "LLM call failed (attempt %d/%d): %s", attempt, retries, e
            )
            if attempt < retries:
                await asyncio.sleep(RETRY_DELAY_S)

    raise RuntimeError(f"LLM call failed after {retries} attempts: {last_error}")


async def chat_completion_json(
    *,
    system: str,
    user: str,
    temperature: float = 0.1,
    max_retries: int = 2,
) -> dict:
    """Call OpenAI and parse the JSON response.

    Returns a dict. Raises RuntimeError on failure.
    """
    text = await chat_completion(
        system=system,
        user=user,
        temperature=temperature,
        json_mode=True,
        max_retries=max_retries,
    )
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Resposta do LLM não é JSON válido: {e}") from e

    if not isinstance(data, dict):
        raise RuntimeError("Resposta do LLM não é um objeto JSON")
    return data
