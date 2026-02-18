"""OpenAI LLM client using Responses API with stored prompts."""

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


async def response_create(
    *,
    prompt_id: str,
    prompt_version: str | None = None,
    variables: dict[str, str] | None = None,
    max_retries: int = 2,
) -> str:
    """Call OpenAI Responses API using a stored prompt.

    The stored prompt already contains model, temperature, and system instructions.
    Only the user input (via variables) needs to be provided.

    Returns the assistant's text response.
    Raises RuntimeError on failure after all retries.
    """
    client = get_openai_client()
    retries = min(max(max_retries, MIN_RETRIES), MAX_RETRIES)

    prompt: dict = {"id": prompt_id}
    if prompt_version:
        prompt["version"] = prompt_version
    if variables:
        prompt["variables"] = variables

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = await client.responses.create(prompt=prompt)
            text = (response.output_text or "").strip()
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


async def response_create_json(
    *,
    prompt_id: str,
    prompt_version: str | None = None,
    variables: dict[str, str] | None = None,
    max_retries: int = 2,
) -> dict:
    """Call OpenAI Responses API with stored prompt and parse JSON response.

    Returns a dict. Raises RuntimeError on failure.
    """
    text = await response_create(
        prompt_id=prompt_id,
        prompt_version=prompt_version,
        variables=variables,
        max_retries=max_retries,
    )
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Resposta do LLM não é JSON válido: {e}") from e

    if not isinstance(data, dict):
        raise RuntimeError("Resposta do LLM não é um objeto JSON")
    return data
