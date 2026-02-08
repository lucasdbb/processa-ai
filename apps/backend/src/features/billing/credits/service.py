from src.core.supabase import get_supabase
from src.core.logging import logger


class CreditsService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_user_credits(self, user_id: str) -> dict:
        """Get user's credit balance with subscription and purchased breakdown."""
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
                            "subscription_credits": 0,
                            "subscription_used": 0,
                            "purchased_credits": 0,
                            "purchased_used": 0,
                        }
                    )
                    .execute()
                )
                return self._format_credits_response(
                    result.data[0] if result.data else None, user_id
                )

            return self._format_credits_response(result.data, user_id)
        except Exception as e:
            logger.error(f"Failed to get user credits: {e}")
            # Return default values on error
            return self._format_credits_response(None, user_id)

    def _format_credits_response(self, data: dict | None, user_id: str) -> dict:
        """Format credits data for API response."""
        if not data:
            return {
                "user_id": user_id,
                "subscription": {
                    "total": 0,
                    "used": 0,
                    "available": 0,
                },
                "purchased": {
                    "total": 0,
                    "used": 0,
                    "available": 0,
                },
                "total_available": 0,
                "last_reset_at": None,
            }

        return {
            "user_id": data.get("user_id", user_id),
            "subscription": {
                "total": data.get("subscription_credits", 0),
                "used": data.get("subscription_used", 0),
                "available": data.get("subscription_available", 0),
            },
            "purchased": {
                "total": data.get("purchased_credits", 0),
                "used": data.get("purchased_used", 0),
                "available": data.get("purchased_available", 0),
            },
            "total_available": data.get("total_available", 0),
            "last_reset_at": data.get("last_reset_at"),
        }


credits_service = CreditsService()
