from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from src.core.supabase import get_supabase
from src.features.core.feedback.schemas import FeedbackCreate, FeedbackUpdate

class FeedbackService:
    def __init__(self):
        self.supabase = get_supabase()

    async def create(self, user_id: UUID, data: FeedbackCreate):
        payload = data.model_dump()
        payload["user_id"] = str(user_id)
        
        res = self.supabase.table("feedback").insert(payload).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create feedback")
        return res.data[0]

    async def list_all(self, limit: int = 50, offset: int = 0, status_filter: Optional[str] = None, sort_order: str = "desc"):
        # Join with profiles to get email/name
        # Note: 'profiles' table name in Supabase is usually exposed as 'profiles' if it's in public schema.
        # We need to make sure the foreign key is detected.
        # The migration set user_id REFERENCES public.profiles(id).
        # So we should be able to select profiles(email, name).
        
        try:
            query = self.supabase.table("feedback").select("*, profiles(email, name)", count="exact")
            
            if status_filter:
                query = query.eq("status", status_filter)
                
            res = query.order("created_at", desc=(sort_order == "desc")).range(offset, offset + limit - 1).execute()
            return res.data, res.count
        except Exception as e:
            # Fallback if join fails (e.g. FK issue)
            print(f"Error fetching feedback with profiles: {e}")
            query = self.supabase.table("feedback").select("*", count="exact")
            
            if status_filter:
                query = query.eq("status", status_filter)
                
            res = query.order("created_at", desc=(sort_order == "desc")).range(offset, offset + limit - 1).execute()
            return res.data, res.count

    async def update(self, id: UUID, data: FeedbackUpdate):
        res = self.supabase.table("feedback").update(data.model_dump()).eq("id", str(id)).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Feedback not found")
        return res.data[0]
        
    async def delete(self, id: UUID):
        res = self.supabase.table("feedback").delete().eq("id", str(id)).execute()
        return True
