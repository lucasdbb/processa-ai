
import hashlib
import re
from urllib.parse import unquote, urlparse

import httpx

from src.core.config import settings
from src.core.logging import logger
from src.core.ai_worker_store import create_document


class WorkerException(Exception):
    """Exception for worker errors."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class StorageService:
    def sanitize_path_segment(self, value: str | None, *, default: str) -> str:
        v = (value or "").strip()
        if not v:
            return default
        cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", v).strip("-._")
        return cleaned or default

    def slugify_filename(self, filename: str) -> str:
        name = (filename or "document").strip()
        if name.lower().endswith(".pdf"):
            name = name[:-4]
        name = name.strip() or "document"
        name = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-._")
        return name or "document"

    def infer_pdf_filename_from_url(self, file_url: str) -> str:
        parsed = urlparse((file_url or "").strip())
        path = unquote(parsed.path or "")
        name = (path.rsplit("/", 1)[-1] or "").strip() or "document.pdf"
        if not name.lower().endswith(".pdf"):
            name = f"{name}.pdf"
        return name

    async def generate_signed_url(self, *, bucket: str, storage_path: str, expires_in: int) -> str:
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
        
        # Ensure full URL if relative
        if signed_url.startswith("/"):
            if signed_url.startswith("/storage/v1"):
                signed_url = f"{base_url}{signed_url}"
            elif signed_url.startswith("/object/"):
                signed_url = f"{base_url}/storage/v1{signed_url}"
            else:
                signed_url = f"{base_url}{signed_url}"

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
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        
        # Determine bucket based on functionality (though input usually comes from AI/Office)
        # Assuming "documents" as default for worker inputs
        bucket = "documents"
        
        if not base_url or not api_key:
            raise WorkerException(status_code=500, detail="Supabase Storage não configurado")

        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        slug = self.slugify_filename(filename)
        storage_filename = f"{sha}_{slug}.pdf"
        uid = self.sanitize_path_segment(user_id, default="unknown-user")
        cid = self.sanitize_path_segment(client_id, default="no_client")
        ep = self.sanitize_path_segment(endpoint, default="unknown")

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

        signed_url = await self.generate_signed_url(
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

    async def upload_pdf_to_supabase(
        self,
        *,
        pdf_bytes: bytes,
        user_id: str,
        client_id: str | None,
        functionality: str = "ai",
        job_uuid: str,
        filename: str,
        expires_in: int,
        output: bool = False,
    ) -> dict:
        """Upload PDF to Supabase Storage. Structure: user_id/functionality/client_id/job_uuid/[input|output]/hash.pdf"""
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        
        # Select bucket based on functionality
        func_lower = functionality.lower().strip()
        bucket = "blog-images" if func_lower in ("blog", "media") else "documents"

        if not base_url or not api_key:
            raise WorkerException(status_code=500, detail="Supabase Storage não configurado")

        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        folder = "output" if output else "input"
        storage_filename = f"{sha}.pdf"
        
        uid = self.sanitize_path_segment(user_id, default="unknown-user")
        func = self.sanitize_path_segment(functionality, default="ai")
        cid = self.sanitize_path_segment(client_id, default="no_client")
        jid = self.sanitize_path_segment(job_uuid, default="unknown-job")
        
        storage_path = f"{uid}/{func}/{cid}/{jid}/{folder}/{storage_filename}"

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

        signed_url = await self.generate_signed_url(
            bucket=bucket, storage_path=storage_path, expires_in=expires_in
        )
        
        # generate_signed_url already handles the full URL check in my implementation above

        return {
            "bucket": bucket,
            "storage_path": storage_path,
            "signed_url": signed_url,
            "filename": storage_filename
        }

    async def download_pdf_bytes(self, file_url: str) -> bytes:
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

    async def delete_file(self, *, bucket: str, storage_path: str) -> bool:
        """Deletes a file from Supabase Storage."""
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            logger.error("Cannot delete file: Supabase Storage not configured")
            return False

        # Endpoint: DELETE /storage/v1/object/{bucket}/{path}
        delete_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.delete(
                    delete_url,
                    headers={
                        "apikey": api_key,
                        "Authorization": f"Bearer {api_key}",
                    },
                )
                if resp.status_code >= 400:
                    logger.error(f"Failed to delete file {bucket}/{storage_path}: {resp.status_code} {resp.text}")
                    return False
                return True
        except Exception as e:
            logger.error(f"Error deleting file {bucket}/{storage_path}: {e}")
            return False
