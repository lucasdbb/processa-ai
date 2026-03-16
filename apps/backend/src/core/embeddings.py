"""Google gemini-embedding-001 client for generating embeddings."""

from __future__ import annotations

from google import genai

from src.core.config import settings
from src.core.logging import logger

_client: genai.Client | None = None

EMBEDDING_MODEL = settings.GEMINI_EMBEDDING_MODEL
EMBEDDING_DIMENSIONS = 768
MAX_BATCH_SIZE = 100


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def generate_embedding(text: str) -> list[float]:
    """Generate embedding for a single text."""
    result = await generate_embeddings([text])
    return result[0]


async def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts (max 100 per request).

    Returns list of embedding vectors (768 dimensions each).
    """
    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), MAX_BATCH_SIZE):
        batch = texts[i : i + MAX_BATCH_SIZE]

        try:
            response = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
                config={"output_dimensionality": EMBEDDING_DIMENSIONS},
            )
            for emb in response.embeddings:
                all_embeddings.append(list(emb.values))
        except Exception as e:
            logger.exception("Failed to generate embeddings (batch %d)", i // MAX_BATCH_SIZE)
            raise RuntimeError(f"Embedding generation failed: {e}") from e

    return all_embeddings
