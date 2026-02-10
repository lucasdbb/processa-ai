"""Mistral OCR client with retry logic."""

import asyncio

from mistralai import Mistral
from mistralai.models import DocumentURLChunk

from src.core.config import settings
from src.core.logging import logger

_client: Mistral | None = None

MIN_TEXT_LENGTH = 100
MAX_RETRIES = 3
RETRY_DELAY_S = 2.0


def get_mistral_client() -> Mistral:
    global _client
    if _client is None:
        _client = Mistral(api_key=settings.MISTRAL_API_KEY)
    return _client


async def extract_text_from_url(pdf_url: str) -> str:
    """Extract text from a PDF URL using Mistral OCR.

    Returns the full extracted text.
    Raises RuntimeError if OCR fails or text is insufficient.
    """
    client = get_mistral_client()
    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await client.ocr.process_async(
                model="mistral-ocr-latest",
                document=DocumentURLChunk(document_url=pdf_url),
            )
            break
        except Exception as e:
            last_error = e
            logger.warning(
                "OCR failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY_S)
    else:
        raise RuntimeError(
            f"Erro ao extrair texto do PDF. O documento pode estar corrompido ou protegido. "
            f"Detalhe: {last_error}"
        )

    pages = result.pages or []
    extracted = "\n\n".join(page.markdown for page in pages if page.markdown)

    if not extracted or len(extracted) < MIN_TEXT_LENGTH:
        raise RuntimeError("Não foi possível extrair texto suficiente do PDF.")

    return extracted
