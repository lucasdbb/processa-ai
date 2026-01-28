import re
import unicodedata
from urllib.parse import quote

from fastapi import HTTPException, status

from src.core.supabase import get_supabase


class MaterialsService:
    def __init__(self):
        self.supabase = get_supabase()

    def _strip_accents(self, text: str) -> str:
        normalized = unicodedata.normalize("NFKD", text or "")
        return normalized.encode("ascii", "ignore").decode("ascii")

    def _slugify(self, text: str) -> str:
        s = self._strip_accents(text).strip().lower()
        s = re.sub(r"[^a-z0-9]+", "-", s)
        s = re.sub(r"-+", "-", s).strip("-")
        return s or "material"

    def _folderify(self, text: str) -> str:
        s = self._strip_accents(text).strip().lower()
        s = re.sub(r"[^a-z0-9]+", "_", s)
        s = re.sub(r"_+", "_", s).strip("_")
        return s or "outros"

    def _infer_mime_type(self, filename: str | None, mime_type: str | None) -> str:
        allowed_extensions = {"pdf", "xls", "xlsx", "xlsm", "docx", "csv"}
        mime_type_mapping = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
            "csv": "text/csv",
        }

        if mime_type:
            v = str(mime_type).strip().lower()
            # Se já é um MIME type completo, retorna
            if v.startswith(("application/", "text/", "image/")):
                return v
            # Se é uma extensão, converte para MIME type
            if v in allowed_extensions:
                return mime_type_mapping.get(v, "application/octet-stream")

        if filename and "." in filename:
            ext = filename.rsplit(".", 1)[-1].lower().strip()
            if ext in allowed_extensions:
                return mime_type_mapping.get(ext, "application/octet-stream")

        return "application/pdf"

    def _content_type_for(self, kind: str) -> str:
        # Se já é um MIME type completo, retorna direto
        if kind.startswith(("application/", "text/", "image/")):
            return kind

        # Se é uma extensão, converte
        mapping = {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
            "csv": "text/csv",
        }
        return mapping.get(kind, "application/octet-stream")

    def _mime_type_to_extension(self, mime_type: str) -> str:
        """Converte MIME type para extensão de arquivo"""
        mapping = {
            "application/pdf": "pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
            "application/vnd.ms-excel": "xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
            "application/vnd.ms-excel.sheet.macroEnabled.12": "xlsm",
            "text/csv": "csv",
        }
        return mapping.get(mime_type, "pdf")

    def _extract_signed_url(self, signed) -> str | None:
        if isinstance(signed, dict):
            return (
                signed.get("signedURL")
                or signed.get("signedUrl")
                or signed.get("signed_url")
                or signed.get("url")
            )
        for attr in ("signedURL", "signedUrl", "signed_url", "url"):
            val = getattr(signed, attr, None)
            if val:
                return str(val)
        return None

    async def list_materials(self) -> list[dict]:
        res = (
            self.supabase.table("materials")
            .select("slug,title,description,category,mime_type")
            .eq("is_published", True)
            .order("category", desc=False)
            .order("title", desc=False)
            .execute()
        )
        data = res.data or []
        out: list[dict] = []
        for row in data:
            if not isinstance(row, dict):
                continue
            out.append(
                {
                    "slug": str(row.get("slug") or ""),
                    "title": str(row.get("title") or ""),
                    "description": row.get("description"),
                    "category": str(row.get("category") or ""),
                    "mime_type": str(row.get("mime_type") or "application/pdf"),
                }
            )
        return out

    async def list_admin_materials(self) -> list[dict]:
        res = (
            self.supabase.table("materials")
            .select(
                "id,slug,title,description,category,storage_bucket,storage_path,filename,mime_type,is_published,created_at,updated_at"
            )
            .order("category", desc=False)
            .order("title", desc=False)
            .execute()
        )
        data = res.data or []
        out: list[dict] = []
        for row in data:
            if not isinstance(row, dict):
                continue
            out.append(
                {
                    "id": str(row.get("id") or ""),
                    "slug": str(row.get("slug") or ""),
                    "title": str(row.get("title") or ""),
                    "description": row.get("description"),
                    "category": str(row.get("category") or ""),
                    "storage_bucket": str(row.get("storage_bucket") or "materials"),
                    "storage_path": str(row.get("storage_path") or ""),
                    "filename": str(row.get("filename") or ""),
                    "mime_type": str(row.get("mime_type") or "application/pdf"),
                    "is_published": bool(row.get("is_published")),
                    "created_at": str(row.get("created_at") or ""),
                    "updated_at": str(row.get("updated_at") or ""),
                }
            )
        return out

    async def create_material(
        self,
        *,
        title: str,
        category: str,
        file_bytes: bytes,
        original_filename: str,
        slug: str | None = None,
        description: str | None = None,
        is_published: bool = True,
        mime_type: str | None = None,
    ) -> dict:
        if not title.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Título é obrigatório",
            )
        if not category.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Categoria é obrigatória",
            )
        if not file_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo é obrigatório",
            )

        resolved_slug = self._slugify(slug or title)
        exists = (
            self.supabase.table("materials")
            .select("id")
            .eq("slug", resolved_slug)
            .limit(1)
            .execute()
        )
        if exists.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug já existe")

        mime = self._infer_mime_type(original_filename, mime_type)
        ext = self._mime_type_to_extension(mime)
        folder = self._folderify(category)
        storage_bucket = "materials"
        storage_path = f"{folder}/{resolved_slug}.{ext}"
        filename = original_filename.strip() or f"{resolved_slug}.{ext}"

        try:
            self.supabase.storage.from_(storage_bucket).upload(
                storage_path,
                file_bytes,
                {"content-type": self._content_type_for(mime), "upsert": "true"},
            )
        except Exception as e:
            msg = str(e).strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Falha ao enviar arquivo para Storage{': ' + msg if msg else ''}",
            )

        payload = {
            "slug": resolved_slug,
            "title": title.strip(),
            "description": (description or "").strip() or None,
            "category": category.strip(),
            "storage_bucket": storage_bucket,
            "storage_path": storage_path,
            "filename": filename,
            "mime_type": mime,
            "is_published": bool(is_published),
        }

        try:
            res = self.supabase.table("materials").insert(payload).execute()
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Falha ao salvar material",
                )
            row = res.data[0] or {}
            return {
                **payload,
                "id": str(row.get("id") or ""),
                "created_at": str(row.get("created_at") or ""),
                "updated_at": str(row.get("updated_at") or ""),
            }
        except HTTPException:
            raise
        except Exception as e:
            error_msg = str(e).strip()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Falha ao salvar material: {error_msg}",
            )

    async def update_material(
        self,
        material_id: str,
        *,
        title: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        category: str | None = None,
        is_published: bool | None = None,
        mime_type: str | None = None,
        file_bytes: bytes | None = None,
        original_filename: str | None = None,
    ) -> dict:
        current_res = (
            self.supabase.table("materials")
            .select(
                "id,slug,title,description,category,storage_bucket,storage_path,filename,mime_type,is_published,created_at,updated_at"
            )
            .eq("id", material_id)
            .limit(1)
            .execute()
        )
        if not current_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Material não encontrado",
            )
        current = current_res.data[0] or {}

        updates: dict = {}

        if title is not None:
            v = title.strip()
            if not v:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Título inválido",
                )
            updates["title"] = v

        if description is not None:
            updates["description"] = (description or "").strip() or None

        if category is not None:
            v = category.strip()
            if not v:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Categoria inválida",
                )
            updates["category"] = v

        if is_published is not None:
            updates["is_published"] = bool(is_published)

        next_slug = str(current.get("slug") or "")
        if slug is not None:
            next_slug = self._slugify(slug)
            if next_slug != str(current.get("slug") or ""):
                exists = (
                    self.supabase.table("materials")
                    .select("id")
                    .eq("slug", next_slug)
                    .neq("id", material_id)
                    .limit(1)
                    .execute()
                )
                if exists.data:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Slug já existe",
                    )
                updates["slug"] = next_slug

        next_category = updates.get("category") or str(current.get("category") or "")
        folder = self._folderify(next_category)
        storage_bucket = str(current.get("storage_bucket") or "materials")
        current_storage_path = str(current.get("storage_path") or "")

        if file_bytes is not None and original_filename is not None:
            mime = self._infer_mime_type(
                original_filename,
                mime_type or str(current.get("mime_type") or ""),
            )
            ext = self._mime_type_to_extension(mime)
            new_storage_path = f"{folder}/{next_slug}.{ext}"
            try:
                self.supabase.storage.from_(storage_bucket).upload(
                    new_storage_path,
                    file_bytes,
                    {"content-type": self._content_type_for(mime), "upsert": "true"},
                )
            except Exception as e:
                msg = str(e).strip()
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Falha ao enviar arquivo para Storage{': ' + msg if msg else ''}",
                )

            updates["storage_path"] = new_storage_path
            updates["filename"] = original_filename.strip() or f"{next_slug}.{ext}"
            updates["mime_type"] = mime

            if current_storage_path and current_storage_path != new_storage_path:
                try:
                    self.supabase.storage.from_(storage_bucket).remove([current_storage_path])
                except Exception:
                    pass
        else:
            if mime_type is not None:
                mime = self._infer_mime_type(str(current.get("filename") or ""), mime_type)
                updates["mime_type"] = mime

            if ("slug" in updates or "category" in updates) and current_storage_path:
                current_mime = str(
                    updates.get("mime_type") or current.get("mime_type") or "application/pdf"
                )
                current_ext = self._mime_type_to_extension(current_mime)
                new_storage_path = f"{folder}/{next_slug}.{current_ext}"
                if new_storage_path != current_storage_path:
                    try:
                        move_fn = getattr(self.supabase.storage.from_(storage_bucket), "move", None)
                        if callable(move_fn):
                            move_fn(current_storage_path, new_storage_path)
                            updates["storage_path"] = new_storage_path
                    except Exception:
                        pass

        if not updates:
            return {"updated": False}

        res = self.supabase.table("materials").update(updates).eq("id", material_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao atualizar",
            )
        row = res.data[0] or {}
        merged = {**current, **row}
        return {
            "id": str(merged.get("id") or ""),
            "slug": str(merged.get("slug") or ""),
            "title": str(merged.get("title") or ""),
            "description": merged.get("description"),
            "category": str(merged.get("category") or ""),
            "storage_bucket": str(merged.get("storage_bucket") or "materials"),
            "storage_path": str(merged.get("storage_path") or ""),
            "filename": str(merged.get("filename") or ""),
            "mime_type": str(merged.get("mime_type") or "application/pdf"),
            "is_published": bool(merged.get("is_published")),
            "created_at": str(merged.get("created_at") or ""),
            "updated_at": str(merged.get("updated_at") or ""),
        }

    async def delete_material(self, material_id: str) -> dict:
        res = (
            self.supabase.table("materials")
            .select("id,storage_bucket,storage_path")
            .eq("id", material_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Material não encontrado",
            )
        row = res.data[0] or {}
        storage_bucket = str(row.get("storage_bucket") or "materials")
        storage_path = str(row.get("storage_path") or "")

        if storage_path:
            try:
                self.supabase.storage.from_(storage_bucket).remove([storage_path])
            except Exception:
                pass

        del_res = self.supabase.table("materials").delete().eq("id", material_id).execute()
        return {"id": material_id, "deleted": bool(del_res.data)}

    async def get_download_redirect_url(self, slug: str, *, expires_in: int = 600) -> str:
        res = (
            self.supabase.table("materials")
            .select("storage_bucket,storage_path,filename")
            .eq("slug", slug)
            .eq("is_published", True)
            .limit(1)
            .execute()
        )

        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Material não encontrado",
            )

        row = res.data[0] or {}
        storage_bucket = row.get("storage_bucket")
        storage_path = row.get("storage_path")
        filename = row.get("filename")

        if not storage_bucket or not storage_path or not filename:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Material inválido",
            )

        try:
            signed = self.supabase.storage.from_(storage_bucket).create_signed_url(
                storage_path,
                expires_in,
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao assinar URL do material",
            )

        url = self._extract_signed_url(signed)
        if not url:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao assinar URL do material",
            )

        sep = "&" if "?" in url else "?"
        return f"{url}{sep}download={quote(str(filename))}"
