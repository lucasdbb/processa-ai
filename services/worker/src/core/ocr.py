"""Text extraction: native PDF text, Mistral OCR fallback, HTTP + BeautifulSoup for HTML."""

import asyncio
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup, NavigableString, Tag
from mistralai.client import Mistral
from mistralai.client.models import DocumentURLChunk

from src.core.config import settings
from src.core.logging import logger

_client: Mistral | None = None

MIN_TEXT_LENGTH = 100
MAX_RETRIES = 3
RETRY_DELAY_S = 2.0

# Content types that indicate HTML
_HTML_CONTENT_TYPES = ("text/html", "application/xhtml")

# File extensions that indicate PDF
_PDF_EXTENSIONS = (".pdf",)

# Markers for revoked text — chunker will parse these
REVOGADO_OPEN = "««REVOGADO»»"
REVOGADO_CLOSE = "««/REVOGADO»»"
# Extended marker with the altering law reference captured from DOM context
# Format: ««REVOGADO|Lei nº 13.467/2017»» ... ««/REVOGADO»»
REVOGADO_OPEN_WITH_REF = "««REVOGADO|{}»»"

# Regex to extract law reference from annotation text AFTER a <strike> block
# e.g., "(Redação dada pela Lei nº 13.467, de 2017)" or "(Revogado pela Lei nº 13.467, de 2017)"
_ANNOTATION_RE = re.compile(
    r"\(\s*(?:Reda[çc][aã]o\s+dada|Revogad[oa]|Inclu[ií]d[oa]|Alterad[oa]|Vide)"
    r"\s+pel[ao]\s+"
    r"((?:Lei(?:\s+Complementar)?|Medida\s+Provis[oó]ria|Emenda\s+Constitucional|Decreto(?:-Lei)?)"
    r"\s+n[ºo°]?\s*[\d.,]+(?:\s*,?\s*de\s*\d{1,2}?\s*\.?\s*\d{1,4})?)"
    r"\s*\)",
    re.IGNORECASE,
)


def get_mistral_client() -> Mistral:
    global _client
    if _client is None:
        _client = Mistral(api_key=settings.MISTRAL_API_KEY)
    return _client


def _is_pdf_url(url: str) -> bool:
    """Guess if a URL points to a PDF based on file extension."""
    path = urlparse(url).path.lower()
    return any(path.endswith(ext) for ext in _PDF_EXTENSIONS)


async def extract_text_from_url(url: str) -> str:
    """Extract text from a URL — auto-detects PDF vs HTML.

    For PDFs: tries native text extraction first (free), falls back to Mistral OCR (paid).
    For HTML: fetches page and extracts text with BeautifulSoup (DOM-aware).

    Returns the full extracted text.
    Raises RuntimeError if extraction fails or text is insufficient.
    """
    # If extension clearly indicates PDF, go straight to PDF pipeline
    if _is_pdf_url(url):
        return await _extract_pdf(url)

    # Otherwise, do a HEAD request to check content type
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            head = await client.head(url)
            content_type = head.headers.get("content-type", "").lower()
    except Exception:
        content_type = ""

    if any(ct in content_type for ct in _HTML_CONTENT_TYPES):
        return await _extract_html(url)
    elif "application/pdf" in content_type:
        return await _extract_pdf(url)
    else:
        # Fallback: try HTML first (most common for web pages), then PDF
        try:
            return await _extract_html(url)
        except RuntimeError:
            return await _extract_pdf(url)


def _find_annotation_after_strike(tag: Tag) -> str | None:
    """Look at siblings/text after a <strike> tag to find the law reference annotation.

    On planalto.gov.br, the pattern is:
        <strike>old text</strike>
        <a href="...">(Redação dada pela Lei nº 13.467, de 2017)</a>
    or sometimes:
        <strike>old text</strike>
        (Revogado pela Lei nº 13.467, de 2017)

    We look at the next 3 siblings for the annotation.
    """
    for sibling in _next_siblings_limited(tag, limit=3):
        if isinstance(sibling, NavigableString):
            text = str(sibling).strip()
        elif isinstance(sibling, Tag):
            text = sibling.get_text(strip=True)
        else:
            continue

        if not text:
            continue

        match = _ANNOTATION_RE.search(text)
        if match:
            return match.group(1).strip()

    return None


def _next_siblings_limited(tag: Tag, limit: int = 3):
    """Yield up to `limit` next siblings of a tag."""
    count = 0
    for sibling in tag.next_siblings:
        if count >= limit:
            break
        yield sibling
        count += 1


async def _extract_html(url: str) -> str:
    """Fetch an HTML page and extract its text content with DOM-aware strikethrough handling.

    For each <strike>/<s>/<del> tag:
    1. Looks at DOM siblings to find the annotation "(Redação dada pela Lei nº X)"
    2. Injects structured markers: ««REVOGADO|Lei nº 13.467/2017»» ... ««/REVOGADO»»
    3. This gives the chunker both the revocation status AND the altering law reference
       directly from the HTML structure — no fragile regex on plain text.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; ProcessaAI/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "pt-BR,pt;q=0.9",
                },
            )
            response.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Erro ao acessar URL: {e}") from e

    # Use raw bytes + let BeautifulSoup detect charset from <meta> tags
    # (many .gov.br sites use ISO-8859-1 but don't declare it in HTTP headers)
    soup = BeautifulSoup(response.content, "html.parser")

    # Remove non-content elements
    for tag in soup.find_all(["script", "style", "nav", "header", "footer", "aside", "noscript"]):
        tag.decompose()

    # DOM-aware strikethrough handling:
    # For each <strike>/<s>/<del>, look at siblings to find the annotation,
    # then inject markers WITH the law reference into the text.
    for tag in soup.find_all(["strike", "s", "del"]):
        lei_ref = _find_annotation_after_strike(tag)
        if lei_ref:
            marker_open = REVOGADO_OPEN_WITH_REF.format(lei_ref)
        else:
            marker_open = REVOGADO_OPEN

        tag.insert_before(marker_open)
        tag.insert_after(REVOGADO_CLOSE)

    text = soup.get_text(separator="\n", strip=True)

    if not text or len(text) < MIN_TEXT_LENGTH:
        raise RuntimeError("Não foi possível extrair texto suficiente da página HTML.")

    logger.info("HTML extraction from %s: %d chars", url[:80], len(text))
    return text


async def _extract_pdf(url: str) -> str:
    """Extract text from a PDF URL.

    Strategy:
    1. Download the PDF
    2. Try native text extraction with pymupdf (free, fast)
    3. If native extraction yields insufficient text (scanned PDF), fall back to Mistral OCR (paid)
    """
    # Download PDF to temp file
    pdf_bytes = await _download_pdf(url)

    # Step 1: Try native extraction (free)
    native_text = _extract_pdf_native(pdf_bytes)
    if native_text and len(native_text) >= MIN_TEXT_LENGTH:
        logger.info(
            "PDF native extraction succeeded: %d chars (OCR skipped, no cost)", len(native_text)
        )
        return native_text

    # Step 2: Native failed (scanned PDF) — fall back to Mistral OCR
    logger.info("Native PDF extraction insufficient (%d chars), falling back to Mistral OCR",
                len(native_text) if native_text else 0)
    return await _extract_pdf_ocr(url)


async def _download_pdf(url: str) -> bytes:
    """Download PDF content from URL."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content
    except Exception as e:
        raise RuntimeError(f"Erro ao baixar PDF: {e}") from e


def _extract_pdf_native(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using pymupdf (no API cost)."""
    try:
        import pymupdf

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        pages_text = []
        for page in doc:
            text = page.get_text()
            if text and text.strip():
                pages_text.append(text.strip())
        doc.close()

        return "\n\n".join(pages_text)
    except Exception as e:
        logger.warning("Native PDF extraction failed: %s", e)
        return ""


async def _extract_pdf_ocr(pdf_url: str) -> str:
    """Extract text from a PDF URL using Mistral OCR (paid, for scanned documents)."""
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
            logger.warning("OCR failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)
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
