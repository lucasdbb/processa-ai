import re
from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.shared.database import get_supabase


class BlogService:
    def __init__(self):
        self.supabase = get_supabase()

    def _slugify(self, text: str) -> str:
        s = text.lower()
        s = re.sub(r"[^a-z0-9]+", "-", s)
        s = re.sub(r"-+", "-", s).strip("-")
        return s or "post"

    async def list_published(
        self,
        page: int,
        page_size: int,
        search: str | None,
        category_slug: str | None,
    ):
        start = (page - 1) * page_size
        end = start + page_size - 1
        q = self.supabase.table("blog_posts").select(
            "id,title,slug,excerpt,cover_image_url,category_id,author_id,published_at",
        ).eq("status", "published").order("published_at", desc=True).range(start, end)
        if search:
            q = q.ilike("title", f"%{search}%")
        if category_slug:
            cats = (
                self.supabase
                .table("blog_categories")
                .select("id,slug")
                .eq("slug", category_slug)
                .limit(1)
                .execute()
            )
            if cats.data:
                q = q.eq("category_id", cats.data[0]["id"])
            else:
                return {"items": [], "page": page, "page_size": page_size}
        res = q.execute()
        data = res.data or []
        author_ids = list({row["author_id"] for row in data if row.get("author_id")})
        profiles = {}
        if author_ids:
            pr = (
                self.supabase
                .table("profiles")
                .select("id,full_name")
                .in_("id", author_ids)
                .execute()
            )
            for p in pr.data or []:
                profiles[p["id"]] = p.get("full_name")
        items = []
        for row in data:
            items.append(
                {
                    "id": str(row.get("id")),
                    "title": row.get("title"),
                    "slug": row.get("slug"),
                    "excerpt": row.get("excerpt"),
                    "cover_image_url": row.get("cover_image_url"),
                    "category_id": row.get("category_id"),
                    "author": {
                        "id": str(row.get("author_id")),
                        "name": profiles.get(row.get("author_id")),
                    },
                    "published_at": row.get("published_at"),
                }
            )
        return {"items": items, "page": page, "page_size": page_size}

    async def get_published_by_slug(self, slug: str):
        res = self.supabase.table("blog_posts").select(
            "id,title,slug,excerpt,content,cover_image_url,category_id,author_id,published_at,status",
        ).eq("slug", slug).limit(1).execute()
        data = res.data or []
        if not data or data[0].get("status") != "published":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post não encontrado")
        post = data[0]
        authors_ids = {post.get("author_id")}
        co = (
            self.supabase
            .table("blog_post_authors")
            .select("user_id,role")
            .eq("post_id", post["id"])
            .execute()
        )
        for a in co.data or []:
            authors_ids.add(a["user_id"])
        profiles = []
        if authors_ids:
            pr = (
                self.supabase
                .table("profiles")
                .select("id,full_name")
                .in_("id", list(authors_ids))
                .execute()
            )
            profiles = pr.data or []
        authors = [{"id": str(p["id"]), "name": p.get("full_name")} for p in profiles]
        return {
            "id": str(post.get("id")),
            "title": post.get("title"),
            "slug": post.get("slug"),
            "excerpt": post.get("excerpt"),
            "content": post.get("content"),
            "cover_image_url": post.get("cover_image_url"),
            "category_id": post.get("category_id"),
            "published_at": post.get("published_at"),
            "authors": authors,
        }

    async def create_draft(self, user, data):
        prof = self.supabase.table("profiles").select("role").eq("id", user.id).limit(1).execute()
        role = None
        if prof.data:
            role = prof.data[0].get("role")
        if role != "author" and role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        slug_base = self._slugify(data.title)
        slug = slug_base
        i = 2
        while True:
            chk = self.supabase.table("blog_posts").select("id").eq("slug", slug).limit(1).execute()
            if not chk.data:
                break
            slug = f"{slug_base}-{i}"
            i += 1
        # Map category from slug when provided
        category_id = data.category_id
        if not category_id and getattr(data, "category", None):
            cats = (
                self.supabase
                .table("blog_categories")
                .select("id,slug")
                .eq("slug", data.category)
                .limit(1)
                .execute()
            )
            if cats.data:
                category_id = cats.data[0]["id"]
        payload = {
            "title": data.title,
            "slug": slug,
            "excerpt": data.excerpt,
            "content": data.content,
            "cover_image_url": data.cover_image_url,
            "category_id": category_id,
            "author_id": user.id,
            "status": "draft",
        }
        ins = self.supabase.table("blog_posts").insert(payload).execute()
        if not ins.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao criar",
            )
        post = ins.data[0]
        # Save tags if provided
        try:
            for raw in (getattr(data, "tags", None) or []):
                name = (raw or "").strip()
                if not name:
                    continue
                slug_tag = self._slugify(name)
                existing = (
                    self.supabase
                    .table("blog_tags")
                    .select("id")
                    .eq("slug", slug_tag)
                    .limit(1)
                    .execute()
                )
                tag_id = None
                if existing.data:
                    tag_id = existing.data[0]["id"]
                else:
                    newtag = (
                        self.supabase
                        .table("blog_tags")
                        .insert({"name": name, "slug": slug_tag})
                        .execute()
                    )
                    if newtag.data:
                        tag_id = newtag.data[0]["id"]
                if tag_id:
                    try:
                        self.supabase.table("blog_post_tags").insert({
                            "post_id": post["id"],
                            "tag_id": tag_id,
                        }).execute()
                    except Exception:
                        pass
        except Exception:
            # Ignore tag failures; post is created
            pass
        try:
            self.supabase.table("blog_post_authors").insert({
                "post_id": post["id"],
                "user_id": user.id,
                "role": "main",
            }).execute()
        except Exception:
            pass
        return {"id": str(post.get("id")), "slug": post.get("slug")}

    async def update_draft(self, user, post_id: str, data):
        res = (
            self.supabase
            .table("blog_posts")
            .select("id,author_id,status")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post não encontrado")
        post = rows[0]
        if post.get("status") != "draft":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Somente rascunhos podem ser editados",
            )
        is_author = post.get("author_id") == user.id
        if not is_author:
            co = (
                self.supabase
                .table("blog_post_authors")
                .select("user_id")
                .eq("post_id", post_id)
                .eq("user_id", user.id)
                .limit(1)
                .execute()
            )
            is_author = bool(co.data)
        if not is_author:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        updates = {}
        if data.title is not None:
            updates["title"] = data.title
        if data.excerpt is not None:
            updates["excerpt"] = data.excerpt
        if data.content is not None:
            updates["content"] = data.content
        if data.cover_image_url is not None:
            updates["cover_image_url"] = data.cover_image_url
        if data.category_id is not None:
            updates["category_id"] = data.category_id
        if getattr(data, "category", None):
            cats = (
                self.supabase
                .table("blog_categories")
                .select("id,slug")
                .eq("slug", data.category)
                .limit(1)
                .execute()
            )
            if cats.data:
                updates["category_id"] = cats.data[0]["id"]
        if not updates:
            return {"updated": False}
        upd = self.supabase.table("blog_posts").update(updates).eq("id", post_id).execute()
        return {"updated": bool(upd.data)}

    async def add_coauthor(self, user, post_id: str, co_user_id: str):
        res = (
            self.supabase
            .table("blog_posts")
            .select("id,author_id,status")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post não encontrado")
        post = rows[0]
        is_admin = False
        prof = self.supabase.table("profiles").select("role").eq("id", user.id).limit(1).execute()
        if prof.data:
            is_admin = prof.data[0].get("role") == "admin"
        if not (is_admin or post.get("author_id") == user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        try:
            self.supabase.table("blog_post_authors").insert({
                "post_id": post_id,
                "user_id": co_user_id,
                "role": "co",
            }).execute()
            return {"added": True}
        except Exception:
            return {"added": False}

    async def publish(self, admin_user, post_id: str):
        prof = (
            self.supabase
            .table("profiles")
            .select("role")
            .eq("id", admin_user.id)
            .limit(1)
            .execute()
        )
        role = None
        if prof.data:
            role = prof.data[0].get("role")
        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas admin publica",
            )
        now = datetime.now(timezone.utc).isoformat()
        upd = (
            self.supabase
            .table("blog_posts")
            .update({
                "status": "published",
                "published_at": now,
            })
            .eq("id", post_id)
            .execute()
        )
        if not upd.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Falha ao publicar",
            )
        return {"id": str(post_id), "status": "published"}
