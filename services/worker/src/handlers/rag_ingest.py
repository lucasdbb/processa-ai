"""RAG document ingestion handler — processes uploaded documents into chunks + embeddings."""

from __future__ import annotations

from src.core.db import get_pool
from src.core.embeddings import generate_embeddings
from src.core.logging import logger
from src.core.ocr import extract_text_from_url
from src.core.storage import StorageService
from src.handlers.chunking import chunk_legal_text
from src.handlers.classifier import (
    classify_area,
    detect_compound_document,
    extract_legislacao_from_text,
)


async def handle_rag_ingest(job: dict) -> None:
    """Process a RAG ingestion job.

    Pipeline:
    1. Download PDF from Supabase Storage (if source_type=pdf)
    2. OCR via Mistral
    3. Classify area/tema
    4. Chunk into legal units
    5. Generate embeddings in batch
    6. Insert chunks + embeddings into rag_chunks
    7. Update rag_documents status

    Job payload:
        document_id: UUID of the rag_documents record
        storage_path: Path in Supabase Storage
        bucket: Storage bucket name
        source_type: "pdf" | "text" | "url"
        content: (optional) raw text content for source_type=text
        area_slug: (optional) pre-assigned area slug
        legislacao: (optional) legislation name
    """
    payload = job.get("payload", {})
    document_id = payload.get("document_id")
    source_type = payload.get("source_type", "pdf")
    area_slug = payload.get("area_slug")
    legislacao_hint = payload.get("legislacao")

    if not document_id:
        logger.error("rag_ingest job missing document_id")
        return

    pool = await get_pool()

    try:
        # Update status to processing
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE public.rag_documents SET status = 'processing', updated_at = now() WHERE id = %s",
                    (document_id,),
                )

        # Step 1-2: Get text content
        text = ""
        if source_type == "text":
            text = payload.get("content", "")
        else:
            # For PDF and URL: download and OCR
            storage_path = payload.get("storage_path", "")
            bucket = payload.get("bucket", "documents")

            if source_type == "url":
                pdf_url = payload.get("url", "")
            else:
                # Generate signed URL for the stored PDF
                storage = StorageService()
                pdf_url = await storage.generate_signed_url(
                    bucket=bucket, storage_path=storage_path, expires_in=3600
                )

            if not pdf_url:
                raise RuntimeError("No PDF URL available for OCR")

            text = await extract_text_from_url(pdf_url)

        if not text or len(text.strip()) < 50:
            raise RuntimeError("Texto extraído insuficiente para processamento")

        # Step 3: Classify
        is_compound = detect_compound_document(text, filename=payload.get("original_filename", ""))
        detected_area = area_slug or classify_area(
            text, filename=payload.get("original_filename", "")
        )
        legislacao = legislacao_hint or extract_legislacao_from_text(text)

        # Step 4: Chunk
        chunks = chunk_legal_text(text, legislacao=legislacao)
        if not chunks:
            raise RuntimeError("Nenhum chunk gerado a partir do documento")

        logger.info(
            "Document %s: %d chunks generated (area=%s, legislacao=%s, compound=%s)",
            document_id,
            len(chunks),
            detected_area,
            legislacao,
            is_compound,
        )

        # Step 5: Generate embeddings in batch
        chunk_texts = [c.content for c in chunks]
        embeddings = await generate_embeddings(chunk_texts)

        # Step 6: Insert chunks into database
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                    embedding_str = "[" + ",".join(str(v) for v in embedding) + "]"
                    area_value = detected_area or "geral"

                    await cur.execute(
                        """
                        INSERT INTO public.rag_chunks
                            (document_id, content, section_title, area, tema,
                             legislacao, artigo, chunk_index, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                        """,
                        (
                            document_id,
                            chunk.content,
                            chunk.section_title,
                            area_value,
                            None,  # tema can be set later
                            chunk.legislacao,
                            chunk.artigo,
                            chunk.chunk_index,
                            embedding_str,
                        ),
                    )

        # Step 7: Update document status
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    UPDATE public.rag_documents
                    SET status = 'ready',
                        total_chunks = %s,
                        is_compound = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (len(chunks), is_compound, document_id),
                )

        logger.info(
            "RAG ingest complete for document %s: %d chunks with embeddings",
            document_id,
            len(chunks),
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
                        SET status = 'error', error_message = %s, updated_at = now()
                        WHERE id = %s
                        """,
                        (error_msg, document_id),
                    )
        except Exception:
            logger.exception("Failed to update document error status")
