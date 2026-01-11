from urllib.parse import quote

from fastapi import HTTPException, status

from src.shared.database import get_supabase


class MaterialsService:
    def __init__(self):
        self.supabase = get_supabase()

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
            .select('slug,title,description,"group",mime_type')
            .eq("is_published", True)
            .order('"group"', desc=False)
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
                    "group": str(row.get("group") or ""),
                    "mime_type": str(row.get("mime_type") or "pdf"),
                }
            )
        return out

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
