"""RAG search for the chat — hybrid pgvector cosine + text filtering."""

from __future__ import annotations

from dataclasses import dataclass

from psycopg_pool import AsyncConnectionPool

from src.core.logging import logger


@dataclass
class RagChunk:
    id: str
    content: str
    section_title: str | None
    area: str
    tema: str | None
    legislacao: str | None
    artigo: str | None
    score: float


async def search_legal_chunks(
    pool: AsyncConnectionPool,
    query_embedding: list[float],
    *,
    area: str | None = None,
    top_k: int = 10,
    similarity_threshold: float = 0.3,
) -> list[RagChunk]:
    """Search RAG chunks using pgvector cosine similarity with optional area filter.

    Args:
        pool: Database connection pool.
        query_embedding: The embedding vector for the user's query (768 dims).
        area: Optional area filter (e.g., "trabalhista").
        top_k: Maximum number of results.
        similarity_threshold: Minimum cosine similarity to include.

    Returns:
        List of RagChunk sorted by relevance (highest score first).
    """
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    if area:
        query = """
            SELECT id, content, section_title, area, tema, legislacao, artigo,
                   1 - (embedding <=> %s::vector) AS score
            FROM public.rag_chunks
            WHERE embedding IS NOT NULL
              AND area = %s
              AND 1 - (embedding <=> %s::vector) >= %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        params = (embedding_str, area, embedding_str, similarity_threshold, embedding_str, top_k)
    else:
        query = """
            SELECT id, content, section_title, area, tema, legislacao, artigo,
                   1 - (embedding <=> %s::vector) AS score
            FROM public.rag_chunks
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> %s::vector) >= %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
        """
        params = (embedding_str, embedding_str, similarity_threshold, embedding_str, top_k)

    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, params)
                rows = await cur.fetchall()
    except Exception:
        logger.exception("RAG search failed")
        return []

    return [
        RagChunk(
            id=str(r[0]),
            content=r[1],
            section_title=r[2],
            area=r[3],
            tema=r[4],
            legislacao=r[5],
            artigo=r[6],
            score=float(r[7]),
        )
        for r in rows
    ]
