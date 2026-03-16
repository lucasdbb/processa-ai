"""Legal document chunking — articles as atomic units with revocation detection."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

MIN_CHUNK_SIZE = 200
MAX_CHUNK_SIZE = 2400
OVERLAP_SIZE = 150

# Regex patterns for legal article boundaries
ARTICLE_PATTERN = re.compile(
    r"^(Art(?:igo)?\.?\s*\d+[\w.-]*)", re.MULTILINE | re.IGNORECASE
)
SECTION_PATTERN = re.compile(
    r"^(TÍTULO|CAPÍTULO|SEÇÃO|SUBSEÇÃO|LIVRO|PARTE)\s+",
    re.MULTILINE | re.IGNORECASE,
)

# Markers injected by HTML extractor for strikethrough text.
# Two forms:
#   ««REVOGADO»»          — no law reference found in DOM
#   ««REVOGADO|Lei nº X»» — law reference extracted from DOM sibling
REVOGADO_CLOSE = "««/REVOGADO»»"

# Regex to match both forms of the opening marker
REVOGADO_OPEN_RE = re.compile(r"««REVOGADO(?:\|([^»]*))?»»")


@dataclass
class LegalChunk:
    content: str
    section_title: str | None
    legislacao: str | None
    artigo: str | None
    chunk_index: int
    status: str = "vigente"  # vigente | revogado | alterado
    revogado_por: str | None = None
    # Fields populated by LLM enrichment
    tema: str | None = None
    resumo: str | None = None
    quality: int = 1  # 0=skip, 1=normal, 2=high relevance
    tipo_documento: str | None = None


def chunk_legal_text(
    text: str,
    *,
    legislacao: str | None = None,
) -> list[LegalChunk]:
    """Split legal text into chunks using articles as atomic units.

    Strategy:
    1. Try to split by article boundaries (Art. N)
    2. If no articles found, fall back to paragraph-based splitting
    3. Merge small chunks, split oversized chunks
    4. Detect revoked/amended articles via ««REVOGADO»» markers

    Args:
        text: The full extracted text (may contain ««REVOGADO»» markers).
        legislacao: Name of the legislation (e.g., "CLT", "Código Civil").

    Returns:
        List of LegalChunk with content, metadata, and revocation status.
    """
    if not text or not text.strip():
        return []

    # Try article-based splitting first
    chunks = _split_by_articles(text, legislacao=legislacao)

    # Fallback to paragraph splitting if no articles found
    if not chunks:
        chunks = _split_by_paragraphs(text, legislacao=legislacao)

    # Merge small chunks and split oversized ones
    chunks = _normalize_chunks(chunks)

    # Detect revocation status from markers
    for chunk in chunks:
        _detect_revocation(chunk)

    # Re-index
    for i, chunk in enumerate(chunks):
        chunk.chunk_index = i

    return chunks


def _detect_revocation(chunk: LegalChunk) -> None:
    """Detect if a chunk contains revoked text and extract the altering law reference.

    Parses two forms of markers:
        ««REVOGADO»»text««/REVOGADO»»         — status only
        ««REVOGADO|Lei nº X»»text««/REVOGADO»» — status + law reference from DOM
    """
    content = chunk.content
    open_matches = list(REVOGADO_OPEN_RE.finditer(content))

    if not open_matches:
        return

    # Extract law references from markers (if present)
    law_refs = [m.group(1) for m in open_matches if m.group(1)]
    if law_refs:
        # Use the first non-empty law reference found
        chunk.revogado_por = law_refs[0].strip()

    # Calculate how much of the content is within revocation markers
    clean = REVOGADO_OPEN_RE.sub("", content).replace(REVOGADO_CLOSE, "").strip()

    revoked_text = ""
    remaining = content
    while True:
        match = REVOGADO_OPEN_RE.search(remaining)
        if not match:
            break
        start = match.end()
        end_idx = remaining.find(REVOGADO_CLOSE, start)
        if end_idx == -1:
            revoked_text += remaining[start:]
            break
        revoked_text += remaining[start:end_idx]
        remaining = remaining[end_idx + len(REVOGADO_CLOSE):]

    revoked_ratio = len(revoked_text.strip()) / len(clean) if clean else 0

    if revoked_ratio > 0.7:
        chunk.status = "revogado"
    elif revoked_ratio > 0.1:
        chunk.status = "alterado"
    else:
        chunk.status = "vigente"

    # Clean all markers from final content
    chunk.content = clean


def _split_by_articles(text: str, *, legislacao: str | None) -> list[LegalChunk]:
    """Split text by article boundaries."""
    splits = ARTICLE_PATTERN.split(text)

    if len(splits) <= 1:
        return []

    chunks: list[LegalChunk] = []
    current_section: str | None = None

    # First element is text before any article
    preamble = splits[0].strip()
    if preamble and len(preamble) >= MIN_CHUNK_SIZE:
        # Check for section title in preamble
        section_match = SECTION_PATTERN.search(preamble)
        if section_match:
            current_section = preamble[section_match.start() :].split("\n")[0].strip()

        chunks.append(
            LegalChunk(
                content=preamble,
                section_title=current_section,
                legislacao=legislacao,
                artigo=None,
                chunk_index=0,
            )
        )

    # Process article pairs (header, body)
    for i in range(1, len(splits), 2):
        article_header = splits[i].strip()
        article_body = splits[i + 1].strip() if i + 1 < len(splits) else ""

        # Extract article number
        artigo_match = re.match(r"Art(?:igo)?\.?\s*(\d+[\w.-]*)", article_header, re.IGNORECASE)
        artigo = f"Art. {artigo_match.group(1)}" if artigo_match else article_header

        # Check for section changes within body
        section_match = SECTION_PATTERN.search(article_body)
        if section_match:
            current_section = article_body[section_match.start() :].split("\n")[0].strip()

        content = f"{article_header} {article_body}".strip()

        chunks.append(
            LegalChunk(
                content=content,
                section_title=current_section,
                legislacao=legislacao,
                artigo=artigo,
                chunk_index=0,
            )
        )

    return chunks


def _split_by_paragraphs(text: str, *, legislacao: str | None) -> list[LegalChunk]:
    """Fallback: split by double newlines / paragraphs."""
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: list[LegalChunk] = []
    current_content = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_content) + len(para) + 1 > MAX_CHUNK_SIZE and current_content:
            chunks.append(
                LegalChunk(
                    content=current_content.strip(),
                    section_title=None,
                    legislacao=legislacao,
                    artigo=None,
                    chunk_index=0,
                )
            )
            # Keep overlap
            current_content = current_content[-OVERLAP_SIZE:] + "\n" + para
        else:
            current_content += ("\n" if current_content else "") + para

    if current_content.strip():
        chunks.append(
            LegalChunk(
                content=current_content.strip(),
                section_title=None,
                legislacao=legislacao,
                artigo=None,
                chunk_index=0,
            )
        )

    return chunks


def _normalize_chunks(chunks: list[LegalChunk]) -> list[LegalChunk]:
    """Merge small chunks and split oversized chunks."""
    if not chunks:
        return []

    # Calculate clean length (without markers)
    def _clean_len(content: str) -> int:
        clean = REVOGADO_OPEN_RE.sub("", content).replace(REVOGADO_CLOSE, "")
        return len(clean)

    normalized: list[LegalChunk] = []

    for chunk in chunks:
        cl = _clean_len(chunk.content)

        if cl > MAX_CHUNK_SIZE:
            # Split oversized chunk
            text = chunk.content
            while text:
                split_point = min(MAX_CHUNK_SIZE, len(text))

                # Try to split at a sentence boundary
                if split_point < len(text):
                    last_period = text.rfind(".", 0, split_point)
                    if last_period > MIN_CHUNK_SIZE:
                        split_point = last_period + 1

                part = text[:split_point].strip()
                if part:
                    normalized.append(
                        LegalChunk(
                            content=part,
                            section_title=chunk.section_title,
                            legislacao=chunk.legislacao,
                            artigo=chunk.artigo,
                            chunk_index=0,
                        )
                    )

                # Keep overlap for continuity
                overlap_start = max(0, split_point - OVERLAP_SIZE)
                text = text[overlap_start:] if split_point < len(text) else ""
                if text == part:
                    break

        elif cl < MIN_CHUNK_SIZE and normalized:
            # Merge with previous chunk if it won't exceed max
            prev = normalized[-1]
            merged = prev.content + "\n" + chunk.content
            if _clean_len(merged) <= MAX_CHUNK_SIZE:
                prev.content = merged
            else:
                normalized.append(chunk)
        else:
            normalized.append(chunk)

    return normalized
