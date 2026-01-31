from src.core.supabase import get_supabase
from src.core.logging import logger


class CreditsService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_user_credits(self, user_id: str) -> dict:
        """Get user's credit balance."""
        try:
            result = (
                self.supabase.table("user_credits")
                .select("*")
                .eq("user_id", user_id)
                .single()
                .execute()
            )

            if not result.data:
                # User doesn't have credits record yet, create one with 0 credits
                result = (
                    self.supabase.table("user_credits")
                    .insert(
                        {
                            "user_id": user_id,
                            "total_credits": 0,
                            "used_credits": 0,
                        }
                    )
                    .execute()
                )
                return result.data[0] if result.data else {
                    "user_id": user_id,
                    "total_credits": 0,
                    "used_credits": 0,
                    "available_credits": 0,
                }

            return result.data
        except Exception as e:
            logger.error(f"Failed to get user credits: {e}")
            # Return default values on error
            return {
                "user_id": user_id,
                "total_credits": 0,
                "used_credits": 0,
                "available_credits": 0,
            }


credits_service = CreditsService()
