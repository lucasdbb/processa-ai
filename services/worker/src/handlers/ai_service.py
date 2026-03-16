import hashlib
import io

import httpx
from markdown_pdf import MarkdownPdf, Section

from src.core.config import get_gemini_model, settings
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.storage import StorageService
from src.handlers.pipeline import (
    run_document_analysis,
    run_gemini_multi_pdf_analysis,
    run_gemini_pdf_analysis,
    run_multi_document_analysis,
)
from src.handlers.reports.brief_scanner import generate_brief_scanner_pdf_from_template
from src.handlers.reports.cnis import generate_cnis_pdf_from_template
from src.handlers.reports.process_summary import generate_process_summary_pdf_from_template
from src.prompts.brief_scanner import BRIEF_SCANNER_GEMINI_PROMPT
from src.prompts.cnis import CNIS_GEMINI_PROMPT
from src.prompts.labor_claim import LABOR_CLAIM_PROMPT
from src.prompts.process_summary import PROCESS_SUMMARY_GEMINI_PROMPT


class WorkerException(Exception):
    """Exception for worker errors."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class AiService:
    def __init__(self):
        self.storage = StorageService()

    # ------------------------------------------------------------------ #
    #  Cache
    # ------------------------------------------------------------------ #

    async def _check_cache(self, *, input_hash: str, endpoint_key: str) -> dict | None:
        try:
            from src.core.db import get_pool

            pool = await get_pool()
        except RuntimeError:
            return None

        try:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT result_payload, created_at
                        FROM public.ai_jobs
                        WHERE endpoint_key = %s
                          AND status = 'completed'
                          AND result_payload->>'input_hash' = %s
                        ORDER BY created_at DESC
                        LIMIT 1
                        """,
                        (endpoint_key, input_hash),
                    )
                    row = await cur.fetchone()
                    if not row:
                        return None

                    result_payload, created_at = row
                    logger.info(
                        "Cache hit for hash %s... (created %s)",
                        input_hash[:16],
                        created_at,
                    )
                    return result_payload or {}
        except Exception:
            logger.exception("Erro ao verificar cache")
            return None

    # ------------------------------------------------------------------ #
    #  Supabase Storage helpers (DELEGATED TO StorageService)
    # ------------------------------------------------------------------ #

    # ------------------------------------------------------------------ #
    #  PDF generation
    # ------------------------------------------------------------------ #

    async def _markdown_to_pdf_and_store(
        self,
        *,
        markdown: str,
        filename: str,
        user_id: str,
        client_id: str | None,
        functionality: str = "ai",
        job_uuid: str,
        expires_in: int,
    ) -> dict:
        title = str(filename)
        if title.lower().endswith(".pdf"):
            title = title[:-4]

        pdf_bytes = self._markdown_to_pdf_bytes(markdown, title=title)
        uploaded = await self.storage.upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            functionality=functionality,
            job_uuid=job_uuid,
            filename=filename,
            expires_in=expires_in,
            output=True,
        )

        if "signed_url" in uploaded:
            uploaded["download_url"] = uploaded["signed_url"]

        return {
            "content": pdf_bytes,
            **uploaded,
        }

    def _markdown_to_pdf_bytes(self, markdown: str, *, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise WorkerException(status_code=502, detail="Resposta vazia da análise")

        try:
            pdf = MarkdownPdf(toc_level=0, optimize=True)
            if title:
                pdf.meta["title"] = title
            pdf.add_section(Section(text, toc=False))

            out = io.BytesIO()
            pdf.save_bytes(out)
            pdf_bytes = out.getvalue()
        except WorkerException:
            raise
        except Exception as e:
            logger.error("Falha ao gerar PDF do markdown", exc_info=e)
            raise WorkerException(status_code=502, detail="Falha ao gerar PDF")

        if not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise WorkerException(status_code=502, detail="Falha ao gerar PDF")

        return pdf_bytes

    async def _download_pdf_bytes(self, file_url: str) -> bytes:
        url = (file_url or "").strip()
        if not url:
            raise WorkerException(status_code=400, detail="file_url inválido")

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.get(url)
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao baixar o arquivo")
        except httpx.RequestError:
            raise WorkerException(status_code=502, detail="Erro ao baixar o arquivo")

        if resp.status_code >= 400:
            raise WorkerException(status_code=502, detail="Falha ao baixar o arquivo")

        pdf_bytes = resp.content
        content_type = (resp.headers.get("content-type") or "").lower()
        looks_like_pdf = pdf_bytes.lstrip().startswith(b"%PDF")
        if "application/pdf" not in content_type and not looks_like_pdf:
            raise WorkerException(status_code=400, detail="Envie um arquivo PDF")

        return pdf_bytes

    # ------------------------------------------------------------------ #
    #  Analysis methods (pipeline replaces n8n)
    # ------------------------------------------------------------------ #

    async def _run_analysis_pipeline(
        self,
        *,
        file_url: str,
        endpoint_key: str,
        prompt_config,
        user_id: str,
        client_id: str | None,
        store_pdf: bool,
        store_input_pdf: bool,
        signed_url_expires_in: int,
        job_id: str | None,
        progress: ProgressReporter | None,
        functionality: str = "ai",
    ) -> dict:
        """Shared analysis logic for both CNIS and Process Summary.

        1. Download and hash PDF
        2. Store input PDF if requested
        3. Check cache
        4. Run pipeline (OCR -> Analyze -> Audit)
        5. Store output PDF if requested
        """
        pdf_bytes = await self.storage.download_pdf_bytes(file_url)
        inferred_filename = self.storage.infer_pdf_filename_from_url(file_url)
        input_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            # Adapt return to match expected format if needed.
            # StorageService returns signed_url, we might need download_url.
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Check cache
        cached = await self._check_cache(input_hash=input_hash, endpoint_key=endpoint_key)
        if cached and cached.get("markdown"):
            logger.info("Returning cached result for hash %s...", input_hash[:16])
            cached["cached"] = True
            if input_storage:
                cached["input_storage"] = input_storage
            if store_pdf and not cached.get("storage_path") and job_id:
                job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
                stored = await self._markdown_to_pdf_and_store(
                    markdown=cached["markdown"],
                    filename=inferred_filename,
                    user_id=user_id,
                    client_id=client_id,
                    functionality=functionality,
                    job_uuid=job_uuid_str,
                    expires_in=signed_url_expires_in,
                )
                cached.update(stored)
            return cached

        # Run pipeline (OCR -> Analyze)
        pipeline_result = await run_document_analysis(
            pdf_url=file_url,
            prompt=prompt_config,
            progress=progress,
        )

        markdown = pipeline_result.markdown
        if not markdown:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        response: dict = {
            "markdown": markdown,
            "input_hash": input_hash,
        }

        if input_storage:
            response["input_storage"] = input_storage

        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            stored = await self._markdown_to_pdf_and_store(
                markdown=markdown,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
            )
            response.update(stored)
            return response

        title = inferred_filename
        if title.lower().endswith(".pdf"):
            title = title[:-4]
        content = self._markdown_to_pdf_bytes(markdown, title=title)
        response["content"] = content
        return response

    async def analyze_cnis(
        self,
        *,
        file_url: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze CNIS document using Gemini (PDF bytes sent inline, no OCR).

        Pipeline:
            1. Download PDF
            2. Store input PDF if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        pdf_bytes = await self.storage.download_pdf_bytes(file_url)
        inferred_filename = self.storage.infer_pdf_filename_from_url(file_url)

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_pdf_analysis(
            pdf_bytes=pdf_bytes,
            prompt=CNIS_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("cnis_analysis"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório CNIS",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate PDF once from structured JSON (DOCX -> PDF)
        pdf_bytes = generate_cnis_pdf_from_template(structured_data)

        if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise WorkerException(status_code=502, detail="Falha ao gerar PDF do relatório CNIS")

        response["content"] = pdf_bytes

        # Upload to Supabase if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            uploaded = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=True,
            )
            if "signed_url" in uploaded:
                uploaded["download_url"] = uploaded["signed_url"]
            response.update(uploaded)

        return response

    async def analyze_process_summary(
        self,
        *,
        file_urls: list[str],
        user_id: str,
        client_id: str | None,
        store_pdf: bool = False,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze process documents using Gemini (PDF bytes sent inline, no OCR).

        Accepts multiple PDF files — all are sent to Gemini in a single request.

        Pipeline:
            1. Download all PDFs
            2. Store input PDFs if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        if not file_urls:
            raise WorkerException(status_code=400, detail="Nenhum arquivo enviado")

        # Download all PDFs
        pdf_bytes_list: list[bytes] = []
        for url in file_urls:
            pdf_bytes = await self.storage.download_pdf_bytes(url)
            pdf_bytes_list.append(pdf_bytes)

        inferred_filename = self.storage.infer_pdf_filename_from_url(file_urls[0])

        # Store input PDFs for history (first file only, as representative)
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes_list[0],
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_multi_pdf_analysis(
            pdf_bytes_list=pdf_bytes_list,
            prompt=PROCESS_SUMMARY_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("process_summary"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório de processo",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate PDF once from structured JSON (DOCX -> PDF)
        pdf_bytes_out = generate_process_summary_pdf_from_template(structured_data)

        if not pdf_bytes_out or not pdf_bytes_out.lstrip().startswith(b"%PDF"):
            raise WorkerException(
                status_code=502, detail="Falha ao gerar PDF do relatório de processo"
            )

        response["content"] = pdf_bytes_out

        # Upload to Supabase if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            uploaded = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes_out,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=True,
            )
            if "signed_url" in uploaded:
                uploaded["download_url"] = uploaded["signed_url"]
            response.update(uploaded)

        return response

    async def _run_multi_file_pipeline(
        self,
        *,
        file_urls: list[str],
        endpoint_key: str,
        prompt_config,
        user_id: str,
        client_id: str | None,
        store_pdf: bool,
        signed_url_expires_in: int,
        job_id: str | None,
        progress: ProgressReporter | None,
        user_prompt: str | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Shared analysis logic for multi-file pipelines (labor_claim, brief_scanner)."""
        pipeline_result = await run_multi_document_analysis(
            pdf_urls=file_urls,
            prompt=prompt_config,
            progress=progress,
            user_prompt=user_prompt,
        )

        markdown = pipeline_result.markdown
        if not markdown:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        response: dict = {"markdown": markdown}

        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            stored = await self._markdown_to_pdf_and_store(
                markdown=markdown,
                filename=f"{endpoint_key}_resultado.pdf",
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                expires_in=signed_url_expires_in,
            )
            response.update(stored)
            return response

        content = self._markdown_to_pdf_bytes(markdown, title=endpoint_key)
        response["content"] = content
        return response

    async def _fetch_rag_context(self, query: str, area: str | None = None, top_k: int = 8) -> str:
        """Search RAG chunks and return formatted context string for prompt injection."""
        try:
            from src.core.embeddings import generate_embedding
            from src.core.rag import search_legal_chunks

            query_embedding = await generate_embedding(query[:2000])
            chunks = await search_legal_chunks(
                query_embedding, area=area, top_k=top_k, similarity_threshold=0.35,
            )
            if not chunks:
                return ""

            logger.info("RAG returned %d chunks (top score: %.3f)", len(chunks), chunks[0].score)
            lines = []
            for i, c in enumerate(chunks, 1):
                label_parts = []
                if c.artigo:
                    label_parts.append(c.artigo)
                if c.legislacao:
                    label_parts.append(c.legislacao)
                label = ", ".join(label_parts) or f"Fonte {i}"
                lines.append(f"[{i}] {label}: \"{c.content[:800]}\"")

            return "\n--- LEGISLAÇÃO RELEVANTE (BASE DE CONHECIMENTO) ---\n" + "\n".join(lines)
        except Exception:
            logger.exception("RAG search failed in worker, proceeding without")
            return ""

    async def analyze_labor_claim(
        self,
        *,
        file_urls: list[str],
        user_prompt: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        # Fetch RAG context for labor law based on user prompt
        rag_context = await self._fetch_rag_context(
            query=user_prompt, area="trabalhista",
        )
        enriched_prompt = user_prompt
        if rag_context:
            enriched_prompt = user_prompt + "\n" + rag_context

        return await self._run_multi_file_pipeline(
            file_urls=file_urls,
            endpoint_key="labor_claim",
            prompt_config=LABOR_CLAIM_PROMPT,
            user_id=user_id,
            client_id=client_id,
            store_pdf=store_pdf,
            signed_url_expires_in=signed_url_expires_in,
            job_id=job_id,
            progress=progress,
            user_prompt=enriched_prompt,
            functionality=functionality,
        )

    async def analyze_brief_scanner(
        self,
        *,
        file_url: str,
        user_id: str,
        client_id: str | None,
        store_pdf: bool = True,
        store_input_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        """Analyze a legal brief using Gemini (PDF bytes sent inline, no OCR).

        Pipeline:
            1. Download PDF
            2. Store input PDF if requested
            3. Send PDF bytes directly to Gemini for analysis (returns JSON)
            4. Generate DOCX from JSON, convert to PDF via LibreOffice
            5. Store output PDF if requested
        """
        pdf_bytes = await self.storage.download_pdf_bytes(file_url)
        inferred_filename = self.storage.infer_pdf_filename_from_url(file_url)

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )
            if "signed_url" in input_storage:
                input_storage["download_url"] = input_storage["signed_url"]

        # Run Gemini pipeline (PDF bytes -> Gemini -> JSON)
        pipeline_result = await run_gemini_pdf_analysis(
            pdf_bytes=pdf_bytes,
            prompt=BRIEF_SCANNER_GEMINI_PROMPT,
            progress=progress,
            model=get_gemini_model("brief_scanner"),
        )

        raw_text = pipeline_result.markdown
        structured_data = pipeline_result.structured_data
        token_usage = pipeline_result.token_usage

        if not raw_text:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        if not structured_data:
            raise WorkerException(
                status_code=502,
                detail="Gemini não retornou JSON válido para o relatório do Scanner de Peça",
            )

        response: dict = {
            "markdown": raw_text,
            "structured_data": structured_data,
        }

        if token_usage:
            response["token_usage"] = token_usage.to_dict()

        if input_storage:
            response["input_storage"] = input_storage

        # Generate PDF from structured JSON (DOCX -> PDF)
        pdf_bytes = generate_brief_scanner_pdf_from_template(structured_data)

        if not pdf_bytes or not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise WorkerException(
                status_code=502, detail="Falha ao gerar PDF do relatório do Scanner de Peça"
            )

        response["content"] = pdf_bytes

        # Upload to Supabase if requested
        if store_pdf and job_id:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise WorkerException(
                    status_code=400, detail="SUPABASE_SERVICE_ROLE_KEY não configurada"
                )
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            uploaded = await self.storage.upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                functionality=functionality,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=True,
            )
            if "signed_url" in uploaded:
                uploaded["download_url"] = uploaded["signed_url"]
            response.update(uploaded)

        return response

    async def refund_credits(self, user_id: str, amount: int, reason: str = "job_failed") -> bool:
        """Calls backend to refund credits."""

        # Internal secret or admin key for backend communication
        # Assuming worker has permissions or uses a service role key if needed
        # For now, let's assume we can call an internal endpoint
        # or use DB directly if in same network

        # BETTER APPROACH: Since worker shares DB with backend,
        # use DB directly to avoid auth overhead/circular deps
        # But `CreditsService` logic is in backend.
        # Option A: Re-implement refund logic here (call RPC `grant_credits_to_user`)
        # Option B: Call backend API endpoint (requires auth)

        # Let's go with Option A (DB Direct) for robustness in worker
        try:
            from src.core.db import get_pool

            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "SELECT grant_credits_to_user(%s, %s, %s, 'purchased')",
                        (user_id, amount, reason),
                    )
            return True
        except Exception as e:
            logger.error(f"Failed to refund credits to user {user_id}: {e}")
            return False
