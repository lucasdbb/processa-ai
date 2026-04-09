import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException

from src.core.supabase import get_supabase
from src.features.core.feedback.schemas import FeedbackCreate, FeedbackUpdate

logger = logging.getLogger(__name__)


class FeedbackService:
    def __init__(self):
        self.supabase = get_supabase()

    async def create(self, user_id: UUID, data: FeedbackCreate):
        payload = data.model_dump(exclude_none=True)
        payload["user_id"] = str(user_id)
        payload["reference_code"] = self._generate_reference_code()

        for _ in range(3):
            try:
                res = self.supabase.table("feedback").insert(payload).execute()
            except Exception as exc:
                error_text = str(exc).lower()
                if "reference_code" in error_text and "duplicate" in error_text:
                    payload["reference_code"] = self._generate_reference_code()
                    continue
                raise HTTPException(status_code=500, detail="Failed to create feedback") from exc

            if res.data:
                return res.data[0]

            payload["reference_code"] = self._generate_reference_code()

        raise HTTPException(status_code=500, detail="Failed to create feedback")

    def _generate_reference_code(self) -> str:
        return f"FB-{uuid4().hex[:8].upper()}"

    async def list_all(
        self,
        limit: int = 50,
        offset: int = 0,
        status_filter: Optional[str] = None,
        sort_order: str = "desc",
    ):
        # Join with profiles to get email/name
        # Note: 'profiles' table name in Supabase is usually exposed as 'profiles'
        # if it's in public schema.
        # We need to make sure the foreign key is detected.
        # The migration set user_id REFERENCES public.profiles(id).
        # So we should be able to select profiles(email, name).

        try:
            query = self.supabase.table("feedback").select(
                "*, profiles(email, name)", count="exact"
            )

            if status_filter:
                query = query.eq("status", status_filter)

            res = (
                query.order("created_at", desc=(sort_order == "desc"))
                .range(offset, offset + limit - 1)
                .execute()
            )
            return res.data, res.count
        except Exception as e:
            # Fallback if join fails (e.g. FK issue)
            logger.warning(f"Error fetching feedback with profiles: {e}")
            query = self.supabase.table("feedback").select("*", count="exact")

            if status_filter:
                query = query.eq("status", status_filter)

            res = (
                query.order("created_at", desc=(sort_order == "desc"))
                .range(offset, offset + limit - 1)
                .execute()
            )
            return res.data, res.count

    async def list_by_user(
        self,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        sort_order: str = "desc",
    ):
        query = (
            self.supabase.table("feedback")
            .select("*", count="exact")
            .eq("user_id", str(user_id))
            .neq("status", "archived")
        )

        res = (
            query.order("created_at", desc=(sort_order == "desc"))
            .range(offset, offset + limit - 1)
            .execute()
        )

        return res.data, res.count

    async def withdraw_by_user(self, user_id: UUID, id: UUID):
        res = (
            self.supabase.table("feedback")
            .update({"status": "archived"})
            .eq("id", str(id))
            .eq("user_id", str(user_id))
            .eq("status", "new")
            .execute()
        )

        if not res.data:
            raise HTTPException(status_code=404, detail="Feedback not found")

        return True

    async def update(self, id: UUID, data: FeedbackUpdate):
        existing = (
            self.supabase.table("feedback")
            .select("id, status")
            .eq("id", str(id))
            .limit(1)
            .execute()
        )
        if not existing.data:
            raise HTTPException(status_code=404, detail="Feedback not found")

        if existing.data[0].get("status") == "archived":
            raise HTTPException(
                status_code=409, detail="Archived feedback status cannot be changed"
            )

        res = self.supabase.table("feedback").update(data.model_dump()).eq("id", str(id)).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Feedback not found")
        return res.data[0]

    async def delete(self, id: UUID):
        self.supabase.table("feedback").delete().eq("id", str(id)).execute()
        return True
