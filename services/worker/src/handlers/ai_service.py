import hashlib
import io

import httpx
from markdown_pdf import MarkdownPdf, Section

from src.core.config import settings
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.core.storage import StorageService
from src.handlers.pipeline import run_document_analysis, run_multi_document_analysis
from src.handlers.prompts.brief_scanner import BRIEF_SCANNER_PROMPT
from src.handlers.prompts.cnis import CNIS_PROMPT
from src.handlers.prompts.labor_claim import LABOR_CLAIM_PROMPT
from src.handlers.prompts.process_summary import PROCESS_SUMMARY_PROMPT


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
            # Adapt return to match expected format if needed (StorageService returns signed_url, we might need download_url)
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
        return await self._run_analysis_pipeline(
            file_url=file_url,
            endpoint_key="cnis_analysis",
            prompt_config=CNIS_PROMPT,
            user_id=user_id,
            client_id=client_id,
            store_pdf=store_pdf,
            store_input_pdf=store_input_pdf,
            signed_url_expires_in=signed_url_expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )

    async def analyze_process_summary(
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
        return await self._run_analysis_pipeline(
            file_url=file_url,
            endpoint_key="process_summary",
            prompt_config=PROCESS_SUMMARY_PROMPT,
            user_id=user_id,
            client_id=client_id,
            store_pdf=store_pdf,
            store_input_pdf=store_input_pdf,
            signed_url_expires_in=signed_url_expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )

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
            user_prompt=user_prompt,
            functionality=functionality,
        )

    async def analyze_brief_scanner(
        self,
        *,
        file_urls: list[str],
        user_id: str,
        client_id: str | None,
        store_pdf: bool = True,
        signed_url_expires_in: int = 600,
        job_id: str | None = None,
        progress: ProgressReporter | None = None,
        functionality: str = "ai",
    ) -> dict:
        return await self._run_multi_file_pipeline(
            file_urls=file_urls,
            endpoint_key="brief_scanner",
            prompt_config=BRIEF_SCANNER_PROMPT,
            user_id=user_id,
            client_id=client_id,
            store_pdf=store_pdf,
            signed_url_expires_in=signed_url_expires_in,
            job_id=job_id,
            progress=progress,
            functionality=functionality,
        )

    async def refund_credits(self, user_id: str, amount: int, reason: str = "job_failed") -> bool:
        """Calls backend to refund credits."""

        # Internal secret or admin key for backend communication
        # Assuming worker has permissions or uses a service role key if needed
        # For now, let's assume we can call an internal endpoint or use DB directly if in same network

        # BETTER APPROACH: Since worker shares DB with backend, use DB directly to avoid auth overhead/circular deps
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
