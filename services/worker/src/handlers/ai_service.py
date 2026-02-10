import hashlib
import io
import re
from urllib.parse import unquote, urlparse

import httpx
from markdown_pdf import MarkdownPdf, Section

from src.core.config import settings
from src.core.logging import logger
from src.core.progress import ProgressReporter
from src.handlers.pipeline import run_document_analysis
from src.handlers.prompts.cnis import CNIS_PROMPT
from src.handlers.prompts.process_summary import PROCESS_SUMMARY_PROMPT


class WorkerException(Exception):
    """Exception for worker errors."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class AiService:
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
                        FROM ai_worker.jobs
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
    #  Path / filename helpers
    # ------------------------------------------------------------------ #

    def _sanitize_path_segment(self, value: str | None, *, default: str) -> str:
        v = (value or "").strip()
        if not v:
            return default
        cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", v).strip("-._")
        return cleaned or default

    def _slugify_filename(self, filename: str) -> str:
        name = (filename or "document").strip()
        if name.lower().endswith(".pdf"):
            name = name[:-4]
        name = name.strip() or "document"
        name = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-._")
        return name or "document"

    def _infer_pdf_filename_from_url(self, file_url: str) -> str:
        parsed = urlparse((file_url or "").strip())
        path = unquote(parsed.path or "")
        name = (path.rsplit("/", 1)[-1] or "").strip() or "document.pdf"
        if not name.lower().endswith(".pdf"):
            name = f"{name}.pdf"
        return name

    # ------------------------------------------------------------------ #
    #  Supabase Storage helpers
    # ------------------------------------------------------------------ #

    async def _generate_signed_url(self, *, bucket: str, storage_path: str, expires_in: int) -> str:
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            raise WorkerException(status_code=500, detail="Supabase Storage não configurado")

        sign_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                signed = await client.post(
                    sign_url,
                    headers={
                        "apikey": api_key,
                        "Authorization": f"Bearer {api_key}",
                    },
                    json={"expiresIn": int(expires_in)},
                )
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao gerar URL assinada")
        except httpx.RequestError:
            raise WorkerException(status_code=502, detail="Erro de conexão ao gerar URL assinada")

        if signed.status_code >= 400:
            body = (signed.text or "").strip()
            raise WorkerException(
                status_code=502,
                detail=(
                    "Falha ao gerar URL assinada"
                    + (f" (status {signed.status_code})" if signed.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        try:
            data = signed.json()
        except Exception:
            data = None

        signed_url = None
        if isinstance(data, dict):
            signed_url = data.get("signedURL") or data.get("signedUrl")
        if not signed_url or not isinstance(signed_url, str):
            raise WorkerException(status_code=502, detail="Resposta inválida ao gerar URL assinada")

        return signed_url

    async def upload_input_pdf(
        self,
        *,
        pdf_bytes: bytes,
        filename: str,
        user_id: str,
        client_id: str | None,
        endpoint: str,
        expires_in: int,
    ) -> dict:
        """Upload input PDF to Supabase Storage."""
        from src.core.ai_worker_store import create_document

        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        bucket = (settings.SUPABASE_AI_BUCKET or "").strip()
        if not base_url or not api_key or not bucket:
            raise WorkerException(status_code=500, detail="Supabase Storage não configurado")

        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        slug = self._slugify_filename(filename)
        storage_filename = f"{sha}_{slug}.pdf"
        uid = self._sanitize_path_segment(user_id, default="unknown-user")
        cid = self._sanitize_path_segment(client_id, default="no_client")
        ep = self._sanitize_path_segment(endpoint, default="unknown")

        storage_path = f"{uid}/{cid}/{ep}/input/{storage_filename}"
        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(upload_url, headers=headers, content=pdf_bytes)
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao subir PDF para storage")
        except httpx.RequestError:
            raise WorkerException(
                status_code=502, detail="Erro de conexão ao subir PDF para storage"
            )

        if resp.status_code >= 400:
            body = (resp.text or "").strip()
            raise WorkerException(
                status_code=502,
                detail=(
                    "Falha ao subir PDF para storage"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        signed_url = await self._generate_signed_url(
            bucket=bucket, storage_path=storage_path, expires_in=expires_in
        )

        document_id = None
        try:
            document_id = await create_document(
                user_id=user_id,
                client_id=client_id,
                document_type="input",
                filename=filename,
                storage_path=storage_path,
                bucket=bucket,
                size_bytes=len(pdf_bytes),
                linked_document_id=None,
            )
            logger.info("Input document saved: %s", document_id)
        except Exception:
            logger.exception("Failed to save input document in database")

        return {
            "bucket": bucket,
            "storage_path": storage_path,
            "signed_url": signed_url,
            "document_id": str(document_id) if document_id else None,
        }

    async def _upload_pdf_to_supabase(
        self,
        *,
        pdf_bytes: bytes,
        user_id: str,
        client_id: str | None,
        job_uuid: str,
        filename: str,
        expires_in: int,
        output: bool = False,
    ) -> dict:
        """Upload PDF to Supabase Storage. Structure: user_id/client_id/job_uuid/hash_[input|output].pdf"""
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        bucket = (settings.SUPABASE_AI_BUCKET or "").strip()
        if not base_url or not api_key or not bucket:
            raise WorkerException(status_code=500, detail="Supabase Storage não configurado")

        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        suffix = "_output" if output else "_input"
        storage_filename = f"{sha}{suffix}.pdf"
        uid = self._sanitize_path_segment(user_id, default="unknown-user")
        cid = self._sanitize_path_segment(client_id, default="no_client")
        jid = self._sanitize_path_segment(job_uuid, default="unknown-job")
        storage_path = f"{uid}/{cid}/{jid}/{storage_filename}"

        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(upload_url, headers=headers, content=pdf_bytes)
        except httpx.TimeoutException:
            raise WorkerException(status_code=504, detail="Tempo limite ao subir PDF para storage")
        except httpx.RequestError:
            raise WorkerException(
                status_code=502, detail="Erro de conexão ao subir PDF para storage"
            )

        if resp.status_code >= 400:
            body = (resp.text or "").strip()
            raise WorkerException(
                status_code=502,
                detail=(
                    "Falha ao subir PDF para storage"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        signed_url = await self._generate_signed_url(
            bucket=bucket, storage_path=storage_path, expires_in=expires_in
        )

        if signed_url.startswith("http"):
            download_url = signed_url
        else:
            download_url = f"{base_url}/storage/v1{signed_url}"

        return {
            "bucket": bucket,
            "storage_path": storage_path,
            "download_url": download_url,
        }

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
        job_uuid: str,
        expires_in: int,
    ) -> dict:
        title = str(filename)
        if title.lower().endswith(".pdf"):
            title = title[:-4]

        pdf_bytes = self._markdown_to_pdf_bytes(markdown, title=title)
        uploaded = await self._upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            job_uuid=job_uuid,
            filename=filename,
            expires_in=expires_in,
            output=True,
        )

        return {
            "content": pdf_bytes,
            **uploaded,
        }

    def _markdown_to_pdf_bytes(self, markdown: str, *, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise WorkerException(status_code=502, detail="Resposta vazia da análise")

        try:
            pdf = MarkdownPdf(toc_level=2, optimize=True)
            if title:
                pdf.meta["title"] = title
            pdf.add_section(Section(text))

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
    ) -> dict:
        """Shared analysis logic for both CNIS and Process Summary.

        1. Download and hash PDF
        2. Store input PDF if requested
        3. Check cache
        4. Run pipeline (OCR -> Analyze -> Audit)
        5. Store output PDF if requested
        """
        pdf_bytes = await self._download_pdf_bytes(file_url)
        inferred_filename = self._infer_pdf_filename_from_url(file_url)
        input_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # Store input PDF for history
        input_storage = None
        if store_input_pdf and job_id:
            job_uuid_str = job_id.split(":", 1)[1] if ":" in job_id else job_id
            input_storage = await self._upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                job_uuid=job_uuid_str,
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
                output=False,
            )

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
                    job_uuid=job_uuid_str,
                    expires_in=signed_url_expires_in,
                )
                cached.update(stored)
            return cached

        # Run pipeline (OCR -> Analyze -> Audit)
        pipeline_result = await run_document_analysis(
            pdf_url=file_url,
            prompt=prompt_config,
            progress=progress,
        )

        markdown = pipeline_result.markdown
        if not markdown:
            raise WorkerException(status_code=502, detail="Pipeline retornou resposta vazia")

        response: dict = {
            "audit_score": pipeline_result.audit_score,
            "markdown": markdown,
            "input_hash": input_hash,
        }

        # Include structured_summary for process_summary
        structured_summary = pipeline_result.audit_metadata.get("structured_summary")
        if isinstance(structured_summary, dict):
            response["structured_summary"] = structured_summary

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
        )
