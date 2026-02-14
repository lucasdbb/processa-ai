import hashlib
import io
import re
from urllib.parse import unquote, urlparse

import httpx
from fastapi import HTTPException, status
from markdown_pdf import MarkdownPdf, Section

from src.core.config import settings
from src.core.db import get_pool
from src.core.logging import logger
from src.features.billing.credits.service import credits_service


class AiService:
    async def _check_cache(self, *, input_hash: str, endpoint_key: str) -> dict | None:
        """Verifica se existe análise em cache para o hash fornecido."""
        try:
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
                        f"Cache hit para hash {input_hash[:16]}... (criado em {created_at})"
                    )
                    return result_payload or {}
        except Exception:
            logger.exception("Erro ao verificar cache")
            return None

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

    async def _generate_signed_url(self, *, bucket: str, storage_path: str, expires_in: int) -> str:
        """Gera uma signed URL para um arquivo no Supabase Storage."""
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

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
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao gerar URL assinada",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão ao gerar URL assinada",
            )

        if signed.status_code >= 400:
            body = (signed.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
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

        signed_path = None
        if isinstance(data, dict):
            signed_path = data.get("signedURL") or data.get("signedUrl")
        if not signed_path or not isinstance(signed_path, str):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida ao gerar URL assinada",
            )

        logger.info(f"Supabase signed URL response: {signed_path[:150]}")

        # A API do Supabase retorna um caminho relativo, precisamos adicionar a base_url
        if signed_path.startswith("/"):
            # Se começa com /object/sign, adicionar /storage/v1 antes
            if signed_path.startswith("/object/"):
                signed_url = f"{base_url}/storage/v1{signed_path}"
            else:
                signed_url = f"{base_url}{signed_path}"
        else:
            signed_url = signed_path

        logger.info(f"Final signed URL: {signed_url[:150]}")
        return signed_url

    async def upload_input_pdf(
        self,
        *,
        pdf_bytes: bytes,
        filename: str,
        user_id: str,
        client_id: str | None,
        job_uuid: str,
        expires_in: int,
    ) -> dict:
        """
        Faz upload de um PDF de input para o Supabase Storage.
        Estrutura: user_id/client_id/job_uuid/document_input.pdf

        Retorna:
        - bucket: nome do bucket
        - storage_path: caminho no storage
        - signed_url: URL assinada para acesso
        - document_id: ID do documento no banco (opcional)
        """

        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        bucket = (settings.SUPABASE_AI_BUCKET or "").strip()
        if not base_url or not api_key or not bucket:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

        # Gera hash e path de armazenamento (usando apenas hash para privacidade)
        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        storage_filename = f"{sha}_input.pdf"
        uid = self._sanitize_path_segment(user_id, default="unknown-user")
        cid = self._sanitize_path_segment(client_id, default="no_client")
        jid = self._sanitize_path_segment(job_uuid, default="unknown-job")

        # Estrutura: user_id/client_id/job_uuid/hash_input.pdf
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
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao subir PDF para storage",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão ao subir PDF para storage",
            )

        if resp.status_code >= 400:
            body = (resp.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Falha ao subir PDF para storage"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        # Gera signed URL
        signed_url = await self._generate_signed_url(
            bucket=bucket, storage_path=storage_path, expires_in=expires_in
        )

        return {
            "bucket": bucket,
            "storage_path": storage_path,
            "signed_url": signed_url,
            "checksum_sha256": hashlib.sha256(pdf_bytes).hexdigest(),
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
        """
        Faz upload de PDF para o Supabase Storage.
        Estrutura: user_id/client_id/job_uuid/hash_[input|output].pdf

        Args:
            output: Se True, usa sufixo "_output", senão "_input"
        """
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        bucket = (settings.SUPABASE_AI_BUCKET or "").strip()
        if not base_url or not api_key or not bucket:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

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
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao subir PDF para storage",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão ao subir PDF para storage",
            )

        if resp.status_code >= 400:
            body = (resp.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Falha ao subir PDF para storage"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        # Usar método extraído para gerar signed URL
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

    async def _markdown_to_pdf_and_store(
        self,
        *,
        markdown: str,
        filename: str,
        user_id: str,
        client_id: str | None,
        endpoint: str,
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
            endpoint=endpoint,
            filename=filename,
            expires_in=expires_in,
        )

        return {
            "content": pdf_bytes,
            **uploaded,
        }

    def _markdown_to_pdf_bytes(self, markdown: str, *, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta vazia do n8n",
            )

        try:
            pdf = MarkdownPdf(toc_level=2, optimize=True)
            if title:
                pdf.meta["title"] = title
            pdf.add_section(Section(text))

            out = io.BytesIO()
            pdf.save_bytes(out)
            pdf_bytes = out.getvalue()
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Falha ao gerar PDF do markdown", exc_info=e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar PDF",
            )

        if not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar PDF",
            )

        return pdf_bytes

    async def _download_pdf_bytes(self, file_url: str) -> bytes:
        url = (file_url or "").strip()
        if not url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_url inválido")

        try:
            async with httpx.AsyncClient(timeout=settings.N8N_TIMEOUT_S) as client:
                resp = await client.get(url)
        except httpx.TimeoutException:
            logger.exception(f"Timeout ao baixar arquivo de {url}")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao baixar o arquivo",
            )
        except httpx.RequestError as e:
            logger.exception(f"Erro de conexão ao baixar arquivo de {url}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erro ao baixar o arquivo: {type(e).__name__}",
            )

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao baixar o arquivo",
            )

        pdf_bytes = resp.content

        content_type = (resp.headers.get("content-type") or "").lower()
        looks_like_pdf = pdf_bytes.lstrip().startswith(b"%PDF")
        if "application/pdf" not in content_type and not looks_like_pdf:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Envie um arquivo PDF",
            )

        return pdf_bytes

    async def _call_n8n_cnis_workflow(
        self,
        *,
        pdf_url: str,
        job_id: str | None = None,
        callback_url: str | None = None,
    ) -> dict:
        webhook_url = f"{settings.N8N_BASE_URL}/webhook/{settings.N8N_CNIS_WORKFLOW_ID}"

        auth = None
        if settings.N8N_AUTH_USER and settings.N8N_AUTH_PASSWORD:
            auth = (settings.N8N_AUTH_USER, settings.N8N_AUTH_PASSWORD)

        payload = {
            "pdf_url": pdf_url,
            "job_id": job_id,
            "callback_url": callback_url,
        }

        try:
            logger.info(f"Chamando workflow {webhook_url} (job_id={job_id})")

            async with httpx.AsyncClient(timeout=settings.N8N_TIMEOUT_S) as client:
                resp = await client.post(
                    webhook_url,
                    json=payload,
                    auth=auth,
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao aguardar resposta do n8n",
            )
        except httpx.RequestError as e:
            logger.error("Erro de conexão com n8n", exc_info=e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão com o serviço de análise",
            )

        try:
            data = resp.json()
        except Exception:
            content_type = (resp.headers.get("content-type") or "").lower()
            body_preview = ""
            if "application/json" not in content_type:
                body_preview = (resp.text or "").strip().replace("\n", " ")[:300]
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Resposta inválida do n8n"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body_preview}" if body_preview else "")
                ),
            )

        if resp.status_code >= 400:
            detail = "Erro ao processar CNIS"
            if isinstance(data, dict):
                detail = data.get("message") or detail
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida do n8n",
            )

        if data.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=data.get("message", "Erro no processamento do CNIS"),
            )

        if data.get("status") != "ok":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Status inesperado do n8n: {data.get('status')}",
            )

        markdown = data.get("text")
        if not markdown:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta do n8n não contém 'text'",
            )

        metadata = data.get("metadata", {})
        return {
            "markdown": str(markdown),
            "audit_score": metadata.get("audit_score"),
            "metadata": metadata,
        }

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
        callback_url: str | None = None,
    ) -> dict:
        pdf_bytes = await self._download_pdf_bytes(file_url)
        inferred_filename = self._infer_pdf_filename_from_url(file_url)

        # Verificar cache baseado no hash do arquivo
        input_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # Salvar PDF de input para histórico (se solicitado)
        input_storage = None
        if store_input_pdf:
            input_storage = await self._upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                endpoint="cnis_analysis/input",
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
            )

        cached = await self._check_cache(input_hash=input_hash, endpoint_key="cnis_analysis")
        if cached and cached.get("markdown"):
            logger.info(f"Retornando resultado do cache para hash {input_hash[:16]}...")
            cached["cached"] = True
            if input_storage:
                cached["input_storage"] = input_storage
            if store_pdf and not cached.get("storage_path"):
                # Gerar PDF do cache se necessário
                stored = await self._markdown_to_pdf_and_store(
                    markdown=cached["markdown"],
                    filename=inferred_filename,
                    user_id=user_id,
                    client_id=client_id,
                    endpoint="cnis_analysis/output",
                    expires_in=signed_url_expires_in,
                )
                cached.update(stored)
            return cached

        # Consumir créditos antes de processar
        credit_result = await credits_service.consume_credits(user_id, 'cnis_analysis')
        if not credit_result.success:
             raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Créditos insuficientes para realizar esta análise."
            )

        try:
            result = await self._call_n8n_cnis_workflow(
                pdf_url=file_url, job_id=job_id, callback_url=callback_url
            )
        except Exception as e:
            # Reembolsar em caso de erro no processamento
            await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_cnis_analysis_error")
            raise e

        markdown = (result.get("markdown") or "").strip()
        if not markdown:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida do n8n",
            )

        response = {
            "audit_score": result.get("audit_score"),
            "markdown": markdown,
            "input_hash": input_hash,
        }

        if input_storage:
            response["input_storage"] = input_storage

        if store_pdf:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="SUPABASE_SERVICE_ROLE_KEY não configurada",
                )

            stored = await self._markdown_to_pdf_and_store(
                markdown=markdown,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                endpoint="cnis_analysis/output",
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

    async def _call_n8n_process_summary_workflow(
        self,
        *,
        pdf_url: str,
        job_id: str | None = None,
        callback_url: str | None = None,
    ) -> dict:
        webhook_url = f"{settings.N8N_BASE_URL}/webhook/{settings.N8N_PROCESS_SUMMARY_WORKFLOW_ID}"

        auth = None
        if settings.N8N_AUTH_USER and settings.N8N_AUTH_PASSWORD:
            auth = (settings.N8N_AUTH_USER, settings.N8N_AUTH_PASSWORD)

        payload = {
            "pdf_url": pdf_url,
            "job_id": job_id,
            "callback_url": callback_url,
        }

        try:
            logger.info(f"Chamando workflow {webhook_url} (job_id={job_id})")

            async with httpx.AsyncClient(timeout=settings.N8N_TIMEOUT_S) as client:
                resp = await client.post(
                    webhook_url,
                    json=payload,
                    auth=auth,
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao aguardar resposta do n8n",
            )
        except httpx.RequestError as e:
            logger.error("Erro de conexão com n8n", exc_info=e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão com o serviço de análise",
            )

        try:
            data = resp.json()
        except Exception:
            content_type = (resp.headers.get("content-type") or "").lower()
            body_preview = ""
            if "application/json" not in content_type:
                body_preview = (resp.text or "").strip().replace("\n", " ")[:300]
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Resposta inválida do n8n"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body_preview}" if body_preview else "")
                ),
            )

        if resp.status_code >= 400:
            detail = "Erro ao processar resumo de processo"
            if isinstance(data, dict):
                detail = data.get("message") or detail
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

        if not isinstance(data, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida do n8n",
            )

        if data.get("status") == "error":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=data.get("message", "Erro no processamento do resumo de processo"),
            )

        if data.get("status") != "ok":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Status inesperado do n8n: {data.get('status')}",
            )

        markdown = data.get("text")
        if not markdown:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta do n8n não contém 'text'",
            )

        metadata = data.get("metadata", {})
        return {
            "markdown": str(markdown),
            "audit_score": metadata.get("audit_score"),
            "structured_summary": metadata.get("structured_summary"),
            "metadata": metadata,
        }

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
        callback_url: str | None = None,
    ) -> dict:
        """Analisa um PDF de processo e gera resumo executivo."""
        pdf_bytes = await self._download_pdf_bytes(file_url)
        inferred_filename = self._infer_pdf_filename_from_url(file_url)

        # Verificar cache baseado no hash do arquivo
        input_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # Salvar PDF de input para histórico (se solicitado)
        input_storage = None
        if store_input_pdf:
            input_storage = await self._upload_pdf_to_supabase(
                pdf_bytes=pdf_bytes,
                user_id=user_id,
                client_id=client_id,
                job_uuid=job_id.split(":")[-1] if job_id and ":" in job_id else "unknown",
                filename=inferred_filename,
                expires_in=signed_url_expires_in,
            )

        cached = await self._check_cache(input_hash=input_hash, endpoint_key="process_summary")
        if cached and cached.get("markdown"):
            logger.info(f"Retornando resultado do cache para hash {input_hash[:16]}...")
            cached["cached"] = True
            if input_storage:
                cached["input_storage"] = input_storage
            if store_pdf and not cached.get("storage_path"):
                # Gerar PDF do cache se necessário
                stored = await self._markdown_to_pdf_and_store(
                    markdown=cached["markdown"],
                    filename=inferred_filename,
                    user_id=user_id,
                    client_id=client_id,
                    endpoint="process_summary/output",
                    expires_in=signed_url_expires_in,
                )
                cached.update(stored)
            return cached

        # Consumir créditos antes de processar
        credit_result = await credits_service.consume_credits(user_id, 'process_summary')
        if not credit_result.success:
             raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Créditos insuficientes para realizar este resumo."
            )

        try:
            result = await self._call_n8n_process_summary_workflow(
                pdf_url=file_url, job_id=job_id, callback_url=callback_url
            )
        except Exception as e:
            # Reembolsar em caso de erro no processamento
            await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_process_summary_error")
            raise e

        markdown = (result.get("markdown") or "").strip()
        if not markdown:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida do n8n",
            )

        response = {
            "audit_score": result.get("audit_score"),
            "structured_summary": result.get("structured_summary"),
            "markdown": markdown,
            "input_hash": input_hash,
        }

        if input_storage:
            response["input_storage"] = input_storage

        if store_pdf:
            if not (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="SUPABASE_SERVICE_ROLE_KEY não configurada",
                )

            stored = await self._markdown_to_pdf_and_store(
                markdown=markdown,
                filename=inferred_filename,
                user_id=user_id,
                client_id=client_id,
                endpoint="process_summary/output",
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

    async def _call_n8n_chat_workflow(
        self,
        *,
        message: str,
        user_id: str,
        client_id: str | None = None,
    ) -> dict:
        webhook_url = f"{settings.N8N_BASE_URL}/webhook/{settings.N8N_CHAT_WORKFLOW_ID}"

        auth = None
        if settings.N8N_AUTH_USER and settings.N8N_AUTH_PASSWORD:
            auth = (settings.N8N_AUTH_USER, settings.N8N_AUTH_PASSWORD)

        payload = {
            "message": message,
            "user_id": user_id,
            "client_id": client_id,
        }

        try:
            async with httpx.AsyncClient(timeout=settings.N8N_TIMEOUT_S) as client:
                resp = await client.post(
                    webhook_url,
                    json=payload,
                    auth=auth,
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao aguardar resposta do chat",
            )
        except httpx.RequestError as e:
            logger.error("Erro de conexão com n8n (chat)", exc_info=e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão com o serviço de chat",
            )

        try:
            data = resp.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida do serviço de chat",
            )
            
        return data

    async def chat(
        self,
        *,
        message: str,
        user_id: str,
        client_id: str | None = None,
    ) -> dict:
        """Processa mensagem de chat jurídico."""
        
        # Consumir créditos (1 crédito por mensagem)
        credit_result = await credits_service.consume_credits(user_id, 'chat_message')
        if not credit_result.success:
             raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Créditos insuficientes para enviar mensagem."
            )

        try:
            result = await self._call_n8n_chat_workflow(
                message=message, user_id=user_id, client_id=client_id
            )
            
            # Se falhar no n8n, lançamos erro e reembolsamos?
            # Se o n8n retornar erro explícito, sim.
            if result.get("status") == "error":
                 raise Exception(result.get("message", "Erro no chat"))
                 
            return {
                "response": result.get("output", result.get("text", "")),
                "credits_consumed": 1
            }
            
        except Exception as e:
            # Reembolsar em caso de erro
            await credits_service.refund_credits(user_id, credit_result.credits_consumed, "refund_chat_error")
            raise e
