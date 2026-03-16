import re
import uuid
from urllib.parse import unquote, urlparse

import httpx
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger
from src.features.core.storage.schemas import FunctionalityType


class StorageService:
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

    async def generate_signed_url(self, *, bucket: str, storage_path: str, expires_in: int) -> str:
        """Gera uma signed URL para download (GET) no Supabase Storage."""
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
        except Exception as e:
            logger.exception(f"Erro ao gerar URL assinada: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao conectar com storage",
            )

        if signed.status_code != 200:
            logger.error(f"Erro Supabase Storage ({signed.status_code}): {signed.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao gerar URL de download",
            )

        data = signed.json()
        signed_url = data.get("signedURL")

        # A API do Supabase retorna um caminho relativo, precisamos adicionar a base_url
        if signed_url and signed_url.startswith("/"):
            # Se começa com /object/sign, adicionar /storage/v1 antes se não tiver
            # Supabase self-hosted pode retornar /storage/v1/object/sign...
            # ou apenas /object/sign...
            if signed_url.startswith("/storage/v1"):
                signed_url = f"{base_url}{signed_url}"
            elif signed_url.startswith("/object/"):
                signed_url = f"{base_url}/storage/v1{signed_url}"
            else:
                signed_url = f"{base_url}{signed_url}"

        return signed_url

    def _get_bucket_for_functionality(self, functionality: str) -> str:
        func = functionality.lower().strip()
        if func in ("blog", "media"):
            return "blog-images"
        else:
            return "documents"

    async def create_upload_signed_url(
        self,
        *,
        filename: str,
        user_id: str,
        functionality: FunctionalityType,
        client_id: str | None = None,
        job_uuid: str | None = None,
        expires_in: int = 3600,
    ) -> dict:
        """
        Gera URL assinada para upload direto (frontend -> supabase).
        Retorna dicionário com upload_url, storage_path, bucket e job_uuid.
        """
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nome do arquivo é obrigatório",
            )

        # 1. Definir bucket
        # functionality já é validado pelo Pydantic/FastAPI,
        # então podemos confiar que é um dos valores do Enum
        bucket = self._get_bucket_for_functionality(functionality.value)

        # 2. Definir caminho
        sanitized_func = self._sanitize_path_segment(functionality.value, default="ai")
        sanitized_user = self._sanitize_path_segment(user_id, default="unknown-user")
        sanitized_client = self._sanitize_path_segment(client_id, default="no-client")

        final_job_uuid = job_uuid or str(uuid.uuid4())
        sanitized_job = self._sanitize_path_segment(final_job_uuid, default="no-job")

        slug_filename = self._slugify_filename(filename)
        # Garantir extensão .pdf se for AI/Office, mas permitir outras se for storage genérico
        # Para consistência com AI, se for PDF mantemos .pdf
        if filename.lower().endswith(".pdf") and not slug_filename.endswith(".pdf"):
            slug_filename += ".pdf"

        # Estrutura: user_id/functionality/client_id/job_uuid/input/filename
        # Mantendo compatibilidade com AI Worker que espera input/
        folder = "input"
        storage_path = (
            f"{sanitized_user}/{sanitized_func}/{sanitized_client}/"
            f"{sanitized_job}/{folder}/{slug_filename}"
        )

        # 3. Gerar URL assinada para UPLOAD (PUT)
        # Endpoint: /storage/v1/object/upload/sign/{bucket}/{path}
        sign_url = f"{base_url}/storage/v1/object/upload/sign/{bucket}/{storage_path}"

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
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
                detail="Tempo limite ao gerar URL de upload",
            )
        except Exception as e:
            logger.exception(f"Erro ao gerar URL de upload: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao conectar com storage",
            )

        if resp.status_code >= 400:
            logger.error(f"Erro Supabase Upload Sign ({resp.status_code}): {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar URL de upload",
            )

        data = resp.json()
        signed_url = data.get("signedURL") or data.get("url")

        if not signed_url:
            # Tentar construir se vier token
            token = data.get("token")
            if token:
                # Se vier token, assumimos que podemos montar a URL de upload direto com token?
                # Geralmente signedURL vem completo.
                pass

        if not signed_url:
            raise HTTPException(
                status_code=502, detail="Resposta inválida do Supabase (upload url)"
            )

        # Se a URL for relativa
        if signed_url.startswith("/"):
            # Se começa com /object/sign, adicionar /storage/v1 antes
            if signed_url.startswith("/object/"):
                signed_url = f"{base_url}/storage/v1{signed_url}"
            else:
                signed_url = f"{base_url}{signed_url}"

        return {
            "upload_url": signed_url,
            "storage_path": storage_path,
            "bucket": bucket,
            "job_uuid": final_job_uuid,
        }

    async def upload_file(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        user_id: str,
        functionality: str = "ai",
        bucket: str = "documents",
        content_type: str = "application/pdf",
    ) -> dict:
        """Upload a file directly to Supabase Storage from the backend.

        Returns dict with bucket, storage_path.
        """
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

        uid = self._sanitize_path_segment(user_id, default="unknown-user")
        func = self._sanitize_path_segment(functionality, default="ai")
        file_uuid = str(uuid.uuid4())
        slug = self._slugify_filename(filename)
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "pdf"
        storage_path = f"{uid}/{func}/{file_uuid}/{slug}.{ext}"

        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(upload_url, headers=headers, content=file_bytes)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao subir arquivo para storage",
            )
        except Exception as e:
            logger.exception("Erro ao subir arquivo para storage: %s", e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao conectar com storage",
            )

        if resp.status_code >= 400:
            logger.error("Upload failed (%d): %s", resp.status_code, resp.text[:200])
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao subir arquivo para storage",
            )

        return {"bucket": bucket, "storage_path": storage_path}

    async def delete_file(self, *, bucket: str, storage_path: str) -> bool:
        """Delete a file from Supabase Storage."""
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()

        if not base_url or not api_key:
            logger.error("Cannot delete file: Supabase Storage not configured")
            return False

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
                    logger.error(
                        "Failed to delete file %s/%s: %d %s",
                        bucket,
                        storage_path,
                        resp.status_code,
                        resp.text[:200],
                    )
                    return False
                return True
        except Exception as e:
            logger.error("Error deleting file %s/%s: %s", bucket, storage_path, e)
            return False
