"""RAG document ingestion handler — processes uploaded documents into enriched chunks + embeddings.

Pipeline (with real-time progress):
1. [5%]  Extract text (HTML DOM-aware / PDF native / Mistral OCR fallback)
2. [15%] LLM classify document (legislacao, area, tipo)
3. [25%] Chunk into legal units (articles as atomic units)
4. [55%] LLM enrich chunks in batch (tema, resumo, quality, revogado_por)
5. [80%] Generate embeddings for content + resumo (dual embedding)
6. [95%] Insert enriched chunks into rag_chunks
7. [100%] Done
"""

from __future__ import annotations

from src.core.db import get_pool
from src.core.embeddings import generate_embeddings
from src.core.logging import logger
from src.core.ocr import extract_text_from_url
from src.core.storage import StorageService
from src.handlers.chunking import chunk_legal_text
from src.handlers.enrichment import classify_document, enrich_chunks


async def _update_progress(pool, document_id: str, progress: int, message: str) -> None:
    """Update progress on the rag_documents table for real-time frontend feedback."""
    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE public.rag_documents
                    SET progress = %s, progress_message = %s, updated_at = now()
                    WHERE id = %s
                    """,
                    (progress, message, document_id),
                )
    except Exception:
        logger.warning("Failed to update progress for document %s", document_id)


async def handle_rag_ingest(job: dict) -> None:
    """Process a RAG ingestion job.

    Job payload:
        document_id: UUID of the rag_documents record
        storage_path: Path in Supabase Storage
        bucket: Storage bucket name
        source_type: "pdf" | "text" | "url"
        content: (optional) raw text content for source_type=text
        url: (optional) URL for source_type=url
        area_slug: (optional) pre-assigned area slug
        legislacao: (optional) legislation name
        original_filename: (optional) original file name
    """
    payload = job.get("payload", {})
    document_id = payload.get("document_id")
    source_type = payload.get("source_type", "pdf")
    area_hint = payload.get("area_slug")
    legislacao_hint = payload.get("legislacao")

    if not document_id:
        logger.error("rag_ingest job missing document_id")
        return

    pool = await get_pool()

    try:
        # ── Update status to processing ──────────────────────────────
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE public.rag_documents
                    SET status = 'processing', progress = 0,
                        progress_message = 'Iniciando processamento...', updated_at = now()
                    WHERE id = %s
                    """,
                    (document_id,),
                )

        # ── Step 1: Extract text ─────────────────────────────────────
        await _update_progress(pool, document_id, 5, "Extraindo texto do documento...")
        text = await _extract_text(payload, source_type)

        if not text or len(text.strip()) < 50:
            raise RuntimeError("Texto extraído insuficiente para processamento")

        # ── Step 2: LLM document classification ──────────────────────
        await _update_progress(pool, document_id, 15, "Classificando documento com IA...")
        available_areas = await _fetch_available_areas(pool)

        classification = await classify_document(
            text, available_areas=available_areas
        )

        legislacao = legislacao_hint or classification.get("legislacao")
        area = area_hint or classification.get("area") or "geral"
        tipo_documento = classification.get("tipo") or "outro"

        logger.info(
            "Document %s classified: legislacao=%s, area=%s, tipo=%s",
            document_id, legislacao, area, tipo_documento,
        )

        # ── Step 3: Chunk into legal units ───────────────────────────
        await _update_progress(pool, document_id, 25, "Dividindo em artigos e seções...")
        chunks = chunk_legal_text(text, legislacao=legislacao)
        if not chunks:
            raise RuntimeError("Nenhum chunk gerado a partir do documento")

        # Log chunk stats
        status_counts: dict[str, int] = {}
        for c in chunks:
            status_counts[c.status] = status_counts.get(c.status, 0) + 1

        logger.info(
            "Document %s: %d chunks generated (status=%s)",
            document_id, len(chunks), status_counts,
        )

        # ── Step 4: LLM enrich chunks ───────────────────────────────
        await _update_progress(
            pool, document_id, 35,
            f"Enriquecendo {len(chunks)} chunks com IA (tema, resumo)..."
        )
        chunks_for_enrichment = [
            {
                "index": c.chunk_index,
                "content": c.content,
                "artigo": c.artigo,
                "status": c.status,
                "revogado_por": c.revogado_por,
            }
            for c in chunks
        ]

        enrichments = await enrich_chunks(
            chunks_for_enrichment, legislacao=legislacao, area=area,
        )

        await _update_progress(pool, document_id, 55, "Enriquecimento concluído. Preparando embeddings...")

        # Merge enrichment results back into chunks
        enrich_map = {e["i"]: e for e in enrichments if isinstance(e, dict)}
        for chunk in chunks:
            e = enrich_map.get(chunk.chunk_index, {})
            chunk.tema = e.get("tema") or chunk.tema
            chunk.resumo = e.get("resumo")
            chunk.quality = e.get("quality", 1)
            chunk.tipo_documento = tipo_documento
            # LLM-detected revogado_por takes precedence if chunk didn't have one from HTML
            if not chunk.revogado_por and e.get("revogado_por"):
                chunk.revogado_por = e["revogado_por"]

        # ── Step 5: Generate embeddings (dual) ───────────────────────
        embeddable = [c for c in chunks if c.quality > 0]
        skip_count = len(chunks) - len(embeddable)
        if skip_count:
            logger.info("Skipping embeddings for %d low-quality chunks", skip_count)

        await _update_progress(
            pool, document_id, 60,
            f"Gerando embeddings para {len(embeddable)} chunks..."
        )
        content_embeddings = await generate_embeddings(
            [c.content for c in embeddable]
        ) if embeddable else []

        # Resumo embeddings (only for chunks that have a resumo)
        resumo_texts = []
        resumo_indices = []
        for i, c in enumerate(embeddable):
            if c.resumo:
                resumo_texts.append(c.resumo)
                resumo_indices.append(i)

        if resumo_texts:
            await _update_progress(
                pool, document_id, 75,
                f"Gerando embeddings para {len(resumo_texts)} resumos..."
            )

        resumo_embeddings_list = await generate_embeddings(resumo_texts) if resumo_texts else []
        resumo_embeddings_map: dict[int, list[float]] = {}
        for idx, emb in zip(resumo_indices, resumo_embeddings_list):
            resumo_embeddings_map[idx] = emb

        # ── Step 6: Insert chunks into database ──────────────────────
        await _update_progress(
            pool, document_id, 90,
            f"Salvando {len(chunks)} chunks no banco de dados..."
        )
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                # Insert embeddable chunks (with embeddings)
                for i, chunk in enumerate(embeddable):
                    embedding_str = "[" + ",".join(str(v) for v in content_embeddings[i]) + "]"
                    resumo_emb = resumo_embeddings_map.get(i)
                    resumo_emb_str = (
                        "[" + ",".join(str(v) for v in resumo_emb) + "]"
                        if resumo_emb else None
                    )

                    await cur.execute(
                        """
                        INSERT INTO public.rag_chunks
                            (document_id, content, section_title, area, tema,
                             legislacao, artigo, chunk_index, embedding,
                             status, revogado_por, resumo, embedding_resumo,
                             quality, tipo_documento)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s, %s, %s, %s::vector, %s, %s)
                        """,
                        (
                            document_id,
                            chunk.content,
                            chunk.section_title,
                            area,
                            chunk.tema,
                            chunk.legislacao,
                            chunk.artigo,
                            chunk.chunk_index,
                            embedding_str,
                            chunk.status,
                            chunk.revogado_por,
                            chunk.resumo,
                            resumo_emb_str,
                            chunk.quality,
                            chunk.tipo_documento,
                        ),
                    )

                # Insert non-embeddable chunks (quality=0, no embeddings)
                non_embeddable = [c for c in chunks if c.quality == 0]
                for chunk in non_embeddable:
                    await cur.execute(
                        """
                        INSERT INTO public.rag_chunks
                            (document_id, content, section_title, area, tema,
                             legislacao, artigo, chunk_index,
                             status, revogado_por, resumo,
                             quality, tipo_documento)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            document_id,
                            chunk.content,
                            chunk.section_title,
                            area,
                            chunk.tema,
                            chunk.legislacao,
                            chunk.artigo,
                            chunk.chunk_index,
                            chunk.status,
                            chunk.revogado_por,
                            chunk.resumo,
                            chunk.quality,
                            chunk.tipo_documento,
                        ),
                    )

        # ── Step 7: Update document status ───────────────────────────
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE public.rag_documents
                    SET status = 'ready',
                        total_chunks = %s,
                        area = %s,
                        legislacao = %s,
                        progress = 100,
                        progress_message = 'Concluído',
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (len(chunks), area, legislacao, document_id),
                )

        logger.info(
            "RAG ingest complete for document %s: %d chunks "
            "(%d with embeddings, %d with resumo, %d skipped)",
            document_id,
            len(chunks),
            len(embeddable),
            len(resumo_texts),
            skip_count,
        )

    except Exception as e:
        error_msg = str(e)[:500]
        logger.exception("RAG ingest failed for document %s", document_id)

        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        UPDATE public.rag_documents
                        SET status = 'error', error_message = %s,
                            progress = 0, progress_message = NULL,
                            updated_at = now()
                        WHERE id = %s
                        """,
                        (error_msg, document_id),
                    )
        except Exception:
            logger.exception("Failed to update document error status")


async def _extract_text(payload: dict, source_type: str) -> str:
    """Extract text from the source based on source_type."""
    if source_type == "text":
        return payload.get("content", "")

    if source_type == "url":
        url = payload.get("url", "")
        if not url:
            raise RuntimeError("No URL provided for source_type=url")
        return await extract_text_from_url(url)

    # PDF from storage
    storage_path = payload.get("storage_path", "")
    bucket = payload.get("bucket", "documents")
    storage = StorageService()
    pdf_url = await storage.generate_signed_url(
        bucket=bucket, storage_path=storage_path, expires_in=3600
    )
    if not pdf_url:
        raise RuntimeError("No PDF URL available")
    return await extract_text_from_url(pdf_url)


async def _fetch_available_areas(pool) -> list[str] | None:
    """Fetch available area slugs from the legal_areas table."""
    try:
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT slug FROM public.legal_areas ORDER BY slug")
                rows = await cur.fetchall()
                if rows:
                    return [r[0] for r in rows]
    except Exception:
        logger.warning("Could not fetch legal_areas, using defaults")
    return None
