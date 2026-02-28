from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.core.supabase import get_supabase
from src.features.core.profiles.schemas import UpdateProfile

try:
    import stripe

    from src.core.config import settings

    stripe.api_key = settings.STRIPE_SECRET_KEY
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False


class ProfilesService:
    def __init__(self):
        self.supabase = get_supabase()

    async def get_profile(self, user_id: str) -> dict:
        """Get user profile by ID."""
        try:
            profile_response = (
                self.supabase.table("profiles")
                .select("id, email, name, role, avatar_url, phone, cpf, created_at")
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
                    .eq("email", profile["email"])
                    .eq("status", "active")
                    .execute()
                )
                newsletter_opt_in = bool(newsletter_res.data)
            except Exception:
                pass

            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("name") or profile["email"].split("@")[0],
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": profile.get("phone"),
                "cpf": profile.get("cpf"),
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
                db_update["name"] = update_data["name"]
            if "avatar_url" in update_data:
                db_update["avatar_url"] = update_data["avatar_url"]
            if "phone" in update_data:
                db_update["phone"] = update_data["phone"]
            if "cpf" in update_data:
                db_update["cpf"] = update_data["cpf"]
            if "company" in update_data:
                db_update["company"] = update_data["company"]
            if "bio" in update_data:
                db_update["bio"] = update_data["bio"]

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
                await self._update_newsletter_status(profile["email"], newsletter_opt_in)

            # Get current newsletter status
            current_newsletter_opt_in = await self._get_newsletter_status(profile["email"])

            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("name", profile["email"].split("@")[0]),
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": profile.get("phone"),
                "cpf": profile.get("cpf"),
                "company": profile.get("company"),
                "bio": profile.get("bio"),
                "newsletter_opt_in": current_newsletter_opt_in,
                "created_at": profile["created_at"],
            }
        except HTTPException:
            raise
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error updating profile: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar perfil: {str(e)}",
            )

    async def list_profiles(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """List all user profiles (admin only)."""
        from src.core.logging import logger

        try:
            fields = (
                "id, email, name, role, avatar_url, phone, "
                "status, bio, company, created_at, updated_at"
            )
            logger.info(f"Fetching profiles with limit={limit}, offset={offset}")
            response = (
                self.supabase.table("profiles")
                .select(fields)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            data = response.data or []
            logger.info(f"Found {len(data)} profiles")

            # Get user_credits and subscriptions for all users
            user_ids = [p["id"] for p in data]
            logger.info(f"User IDs: {user_ids}")

            # Get user_credits (only if there are users)
            user_credits_map = {}
            if user_ids:
                logger.info("Fetching user_credits...")
                user_credits_response = (
                    self.supabase.table("user_credits")
                    .select("user_id, subscription_credits, purchased_credits")
                    .in_("user_id", user_ids)
                    .execute()
                )
                logger.info(f"user_credits response: {user_credits_response.data}")
                user_credits_map = {
                    c["user_id"]: {
                        "subscription": c["subscription_credits"],
                        "purchased": c["purchased_credits"],
                        "total": c["subscription_credits"] + c["purchased_credits"],
                    }
                    for c in (user_credits_response.data or [])
                }

            # Get subscriptions (only if there are users)
            subs_map = {}
            if user_ids:
                logger.info("Fetching subscriptions...")
                subs_response = (
                    self.supabase.table("subscriptions")
                    .select("user_id, plan_id, status")
                    .in_("user_id", user_ids)
                    .execute()
                )
                logger.info(f"subscriptions response: {subs_response.data}")
                subs_map = {
                    s["user_id"]: {"plan_id": s["plan_id"], "status": s["status"]}
                    for s in (subs_response.data or [])
                }

            logger.info("Building final response...")
            return [
                {
                    "id": p["id"],
                    "email": p["email"],
                    "name": p.get("name") or "",
                    "role": p.get("role", "client"),
                    "avatar_url": p.get("avatar_url"),
                    "phone": p.get("phone"),
                    "status": p.get("status", "active"),
                    "bio": p.get("bio"),
                    "company": p.get("company"),
                    "newsletter_opt_in": False,
                    "confirmed_at": None,
                    "created_at": p["created_at"],
                    "updated_at": p.get("updated_at"),
                    "credits": user_credits_map.get(
                        p["id"], {"subscription": 0, "purchased": 0, "total": 0}
                    ),
                    "plan_id": subs_map.get(p["id"], {}).get("plan_id", "free"),
                    "subscription_status": subs_map.get(p["id"], {}).get("status", "active"),
                }
                for p in data
            ]
        except Exception as e:
            logger.error(f"Error listing profiles: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao listar usuários: {str(e)}",
            )

    async def update_role(
        self,
        target_user_id: str,
        role: str,
        subscription_credits: int | None = None,
        purchased_credits: int | None = None,
        plan_id: str | None = None,
    ) -> dict:
        """Update user role, credits (subscription and purchased), and plan (admin only)."""
        valid_roles = {"client", "author", "admin"}
        if role not in valid_roles:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role inválida",
            )

        if plan_id and plan_id not in {"free", "student", "autonomo"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plano inválido. Planos válidos: free, student, autonomo",
            )

        try:
            # Update role
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

            # Update subscription credits if provided
            if subscription_credits is not None:
                self.supabase.rpc(
                    "grant_credits_to_user",
                    {
                        "p_user_id": target_user_id,
                        "p_amount": subscription_credits,
                        "p_reason": "admin_update",
                        "p_credit_type": "subscription",
                    },
                ).execute()

            # Update purchased credits if provided
            if purchased_credits is not None:
                self.supabase.rpc(
                    "grant_credits_to_user",
                    {
                        "p_user_id": target_user_id,
                        "p_amount": purchased_credits,
                        "p_reason": "admin_update",
                        "p_credit_type": "purchased",
                    },
                ).execute()

            # Update plan if provided
            if plan_id:
                sub_res = (
                    self.supabase.table("subscriptions")
                    .select("user_id")
                    .eq("user_id", target_user_id)
                    .execute()
                )

                now = datetime.now(timezone.utc).isoformat()

                if sub_res.data:
                    # Update existing subscription
                    self.supabase.table("subscriptions").update(
                        {
                            "plan_id": plan_id,
                            "status": "active",
                            "updated_at": now,
                        }
                    ).eq("user_id", target_user_id).execute()
                else:
                    # Create new subscription
                    self.supabase.table("subscriptions").insert(
                        {
                            "user_id": target_user_id,
                            "plan_id": plan_id,
                            "status": "active",
                            "created_at": now,
                            "updated_at": now,
                        }
                    ).execute()

            return {
                "message": "Usuário atualizado com sucesso",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "role": user.get("role", role),
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error updating user: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar usuário: {str(e)}",
            )

    async def update_status(self, target_user_id: str, new_status: str) -> dict:
        """Update user status (admin only)."""
        valid_statuses = {"active", "suspended", "deleted"}
        if new_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status inválido",
            )

        try:
            # 1. Update profiles table
            res = (
                self.supabase.table("profiles")
                .update({"status": new_status})
                .eq("id", target_user_id)
                .execute()
            )
            if not res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuário não encontrado",
                )
            user = res.data[0]

            # 2. Sync with Supabase Auth
            if new_status in ("suspended", "deleted"):
                # Ban user (100 years = 876000 hours)
                self.supabase.auth.admin.update_user_by_id(
                    target_user_id, {"ban_duration": "876000h"}
                )
            elif new_status == "active":
                # Unban user
                self.supabase.auth.admin.update_user_by_id(target_user_id, {"ban_duration": "none"})

            return {
                "message": "Status atualizado",
                "user": {
                    "id": user["id"],
                    "email": user["email"],
                    "status": user.get("status", new_status),
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error updating status: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao atualizar status: {str(e)}",
            )

    async def _get_newsletter_status(self, email: str) -> bool:
        """Check if user is subscribed to newsletter."""
        try:
            newsletter_res = (
                self.supabase.table("newsletter_subscriptions")
                .select("status")
                .eq("email", email)
                .eq("status", "active")
                .execute()
            )
            return bool(newsletter_res.data)
        except Exception:
            return False

    async def _update_newsletter_status(self, email: str, opt_in: bool) -> None:
        """Update newsletter subscription status."""
        try:
            if opt_in:
                existing = (
                    self.supabase.table("newsletter_subscriptions")
                    .select("id")
                    .eq("email", email)
                    .execute()
                )

                if existing.data:
                    self.supabase.table("newsletter_subscriptions").update(
                        {
                            "status": "active",
                            "confirmed_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ).eq("id", existing.data[0]["id"]).execute()
                else:
                    self.supabase.table("newsletter_subscriptions").insert(
                        {
                            "email": email,
                            "status": "active",
                            "confirmed_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ).execute()
            else:
                self.supabase.table("newsletter_subscriptions").update(
                    {
                        "status": "unsubscribed",
                        "unsubscribed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).eq("email", email).execute()
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error updating newsletter status: {str(e)}")
            raise

    async def add_user_credits(self, user_id: str, amount: int) -> dict:
        """Add user_credits to user (admin only)."""
        try:
            # Check if user exists
            profile_res = (
                self.supabase.table("profiles")
                .select("id, email, name")
                .eq("id", user_id)
                .execute()
            )
            if not profile_res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuário não encontrado",
                )
            profile = profile_res.data[0]

            # Add user_credits via RPC function
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": amount,
                    "p_reason": "admin_grant",
                    "p_credit_type": "purchased",
                },
            ).execute()

            return {
                "message": f"{amount} créditos adicionados com sucesso",
                "user": {
                    "id": profile["id"],
                    "email": profile["email"],
                    "name": profile.get("name", ""),
                },
                "user_credits_added": amount,
            }
        except HTTPException:
            raise
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error adding user_credits: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao adicionar créditos: {str(e)}",
            )

    async def update_plan(self, user_id: str, plan_id: str) -> dict:
        """Update user's plan (admin only)."""
        valid_plans = {"free", "student", "autonomo"}
        if plan_id not in valid_plans:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plano inválido. Planos válidos: free, student, autonomo",
            )

        try:
            # Check if user exists
            profile_res = (
                self.supabase.table("profiles")
                .select("id, email, name")
                .eq("id", user_id)
                .execute()
            )
            if not profile_res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Usuário não encontrado",
                )
            profile = profile_res.data[0]

            # Check if subscription exists
            sub_res = (
                self.supabase.table("subscriptions").select("id").eq("user_id", user_id).execute()
            )

            now = datetime.now(timezone.utc).isoformat()

            if sub_res.data:
                # Update existing subscription
                self.supabase.table("subscriptions").update(
                    {
                        "plan_id": plan_id,
                        "status": "active",
                        "updated_at": now,
                    }
                ).eq("user_id", user_id).execute()
            else:
                # Create new subscription
                self.supabase.table("subscriptions").insert(
                    {
                        "user_id": user_id,
                        "plan_id": plan_id,
                        "status": "active",
                        "created_at": now,
                        "updated_at": now,
                    }
                ).execute()

            return {
                "message": f"Plano alterado para {plan_id} com sucesso",
                "user": {
                    "id": profile["id"],
                    "email": profile["email"],
                    "name": profile.get("name", ""),
                },
                "plan_id": plan_id,
            }
        except HTTPException:
            raise
        except Exception as e:
            from src.core.logging import logger

            logger.error(f"Error updating plan: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao alterar plano: {str(e)}",
            )

    async def delete_account(self, user_id: str) -> dict:
        """Delete user account and all related data."""
        try:
            # 1. Cancel Stripe subscription and delete customer if exists
            if STRIPE_AVAILABLE:
                try:
                    # Get customer_id from subscriptions table
                    sub_res = (
                        self.supabase.table("subscriptions")
                        .select("stripe_customer_id, stripe_subscription_id")
                        .eq("user_id", user_id)
                        .limit(1)
                        .execute()
                    )

                    if sub_res.data and sub_res.data[0]:
                        subscription_id = sub_res.data[0].get("stripe_subscription_id")
                        customer_id = sub_res.data[0].get("stripe_customer_id")

                        # Cancel active subscription immediately
                        if subscription_id:
                            try:
                                stripe.Subscription.delete(subscription_id)
                            except stripe.InvalidRequestError:
                                pass  # Subscription may not exist or already cancelled

                        # Delete Stripe customer (includes all payment methods)
                        if customer_id:
                            try:
                                stripe.Customer.delete(customer_id)
                            except stripe.InvalidRequestError:
                                pass  # Customer may not exist
                except Exception as e:
                    # Log but don't fail - continue with account deletion
                    from src.core.logging import logger

                    logger.warning(f"Error cancelling Stripe subscription for user {user_id}: {e}")

            # 2. Delete from Supabase Auth (this will cascade delete the profile and related data)
            self.supabase.auth.admin.delete_user(user_id)

            return {"message": "Conta excluída com sucesso"}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao excluir conta: {str(e)}",
            )


profiles_service = ProfilesService()
