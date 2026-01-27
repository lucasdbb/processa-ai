from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.features.profiles.schemas import UpdateProfile
from src.shared.database import get_supabase


class ProfilesService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_profile(self, user_id: str) -> dict:
        """Get user profile by ID."""
        try:
            profile_response = (
                self.supabase.table("profiles")
                .select("id, email, full_name, role, avatar_url, created_at")
                .eq("id", user_id)
                .execute()
            )

            if not profile_response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Perfil não encontrado",
                )

            profile = profile_response.data[0]

            # Get confirmed_at from auth.users
            confirmed_at = None
            try:
                auth_response = self.supabase.auth.admin.get_user_by_id(user_id)
                if auth_response.user and getattr(auth_response.user, "confirmed_at", None):
                    val = auth_response.user.confirmed_at
                    confirmed_at = val.isoformat() if hasattr(val, "isoformat") else str(val)
            except Exception:
                pass

            # Check newsletter status
            newsletter_opt_in = False
            try:
                newsletter_res = (
                    self.supabase.table("newsletter_subscriptions")
                    .select("status")
                    .eq("user_id", user_id)
                    .eq("status", "subscribed")
                    .execute()
                )
                newsletter_opt_in = bool(newsletter_res.data)
            except Exception:
                pass

            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("full_name") or profile["email"].split("@")[0],
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": None,
                "document_type": None,
                "document_number": None,
                "newsletter_opt_in": newsletter_opt_in,
                "confirmed_at": confirmed_at,
                "created_at": profile["created_at"],
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao buscar perfil: {str(e)}",
            )

    async def update_profile(self, user_id: str, profile_data: UpdateProfile) -> dict:
        """Update user profile."""
        try:
            update_data = profile_data.model_dump(exclude_none=True)
            newsletter_opt_in = update_data.pop("newsletter_opt_in", None)

            if not update_data and newsletter_opt_in is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nenhum dado para atualizar",
                )

            # Map frontend fields to database fields
            db_update = {}
            if "name" in update_data:
                db_update["full_name"] = update_data["name"]
            if "avatar_url" in update_data:
                db_update["avatar_url"] = update_data["avatar_url"]
            if "phone" in update_data:
                db_update["phone"] = update_data["phone"]
            if "document_type" in update_data:
                db_update["document_type"] = update_data["document_type"]
            if "document_number" in update_data:
                db_update["document_number"] = update_data["document_number"]

            if db_update:
                response = (
                    self.supabase.table("profiles").update(db_update).eq("id", user_id).execute()
                )
                if not response.data:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Perfil não encontrado",
                    )
                profile = response.data[0]
            else:
                prof_res = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
                if not prof_res.data:
                    raise HTTPException(status_code=404, detail="Perfil não encontrado")
                profile = prof_res.data[0]

            # Update newsletter if requested
            if newsletter_opt_in is not None:
                await self._update_newsletter_status(user_id, profile["email"], newsletter_opt_in)

            # Get current newsletter status
            current_newsletter_opt_in = await self._get_newsletter_status(user_id)

            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("full_name", profile["email"].split("@")[0]),
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": profile.get("phone"),
                "document_type": profile.get("document_type"),
                "document_number": profile.get("document_number"),
                "newsletter_opt_in": current_newsletter_opt_in,
                "created_at": profile["created_at"],
            }
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar perfil",
            )

    async def list_profiles(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """List all user profiles (admin only)."""
        try:
            fields = (
                "id, email, full_name, role, avatar_url, phone, "
                "document_type, document_number, status, created_at"
            )
            response = (
                self.supabase.table("profiles")
                .select(fields)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            data = response.data or []

            return [
                {
                    "id": p["id"],
                    "email": p["email"],
                    "name": p.get("full_name") or "",
                    "role": p.get("role", "user"),
                    "avatar_url": p.get("avatar_url"),
                    "phone": p.get("phone"),
                    "document_type": p.get("document_type"),
                    "document_number": p.get("document_number"),
                    "newsletter_opt_in": False,
                    "confirmed_at": None,
                    "created_at": p["created_at"],
                }
                for p in data
            ]
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar usuários",
            )

    async def update_role(self, target_user_id: str, role: str) -> dict:
        """Update user role (admin only)."""
        valid_roles = {"user", "author", "admin", "premium"}
        if role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role inválida",
            )

        try:
            res = (
                self.supabase.table("profiles")
                .update({"role": role})
                .eq("id", target_user_id)
                .execute()
            )
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuário não encontrado",
                )
            user = res.data[0]
            return {
                "message": "Role atualizada",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "role": user.get("role", role),
                },
            }
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar role",
            )

    async def _get_newsletter_status(self, user_id: str) -> bool:
        """Check if user is subscribed to newsletter."""
        try:
            newsletter_res = (
                self.supabase.table("newsletter_subscriptions")
                .select("status")
                .eq("user_id", user_id)
                .eq("status", "subscribed")
                .execute()
            )
            return bool(newsletter_res.data)
        except Exception:
            return False

    async def _update_newsletter_status(
        self, user_id: str, email: str, opt_in: bool
    ) -> None:
        """Update newsletter subscription status."""
        try:
            if opt_in:
                existing = (
                    self.supabase.table("newsletter_subscriptions")
                    .select("id")
                    .eq("user_id", user_id)
                    .execute()
                )
                if existing.data:
                    self.supabase.table("newsletter_subscriptions").update(
                        {
                            "status": "subscribed",
                            "confirmed_at": datetime.now(timezone.utc).isoformat(),
                            "consent": True,
                        }
                    ).eq("id", existing.data[0]["id"]).execute()
                else:
                    self.supabase.table("newsletter_subscriptions").insert(
                        {
                            "user_id": user_id,
                            "email": email,
                            "status": "subscribed",
                            "confirmed_at": datetime.now(timezone.utc).isoformat(),
                            "consent": True,
                            "channel": "email",
                        }
                    ).execute()
            else:
                self.supabase.table("newsletter_subscriptions").update(
                    {
                        "status": "unsubscribed",
                        "unsubscribed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("user_id", user_id).execute()
        except Exception:
            pass


profiles_service = ProfilesService()
