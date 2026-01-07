"""
User service
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from src.features.users.schemas import UpdateProfile
from src.shared.database import get_supabase


class UserService:
    """User service"""

    def __init__(self):
        self.supabase = get_supabase()

    async def get_profile(self, user_id: str):
        """Get user profile"""
        try:
            # Buscar dados do profile com campos específicos (evita erro se campos não existem)
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

            # Buscar dados do auth.users para pegar confirmed_at
            try:
                auth_response = self.supabase.auth.admin.get_user_by_id(user_id)
                if auth_response.user and getattr(auth_response.user, "confirmed_at", None):
                    val = auth_response.user.confirmed_at
                    confirmed_at = val.isoformat() if hasattr(val, "isoformat") else str(val)
                else:
                    confirmed_at = None
            except Exception:
                confirmed_at = None

            # Verificar status da newsletter
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
                pass  # Falha silenciosa na newsletter não deve quebrar o profile

            # Mapear full_name para name e adicionar confirmed_at
            # Campos phone, document_type, document_number serão None até migration ser aplicada
            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("full_name") or profile["email"].split("@")[0],
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": None,  # Será preenchido após migration
                "document_type": None,  # Será preenchido após migration
                "document_number": None,  # Será preenchido após migration
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

    async def update_profile(self, user_id: str, profile_data: UpdateProfile):
        """Update user profile"""
        try:
            update_data = profile_data.model_dump(exclude_none=True)

            newsletter_opt_in = update_data.pop("newsletter_opt_in", None)

            if not update_data and newsletter_opt_in is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nenhum dado para atualizar",
                )

            # Mapear campos do frontend para o banco
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
            if "documentType" in update_data:
                db_update["document_type"] = update_data["documentType"]
            if "documentNumber" in update_data:
                db_update["document_number"] = update_data["documentNumber"]

            # Se houver dados de perfil para atualizar
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
                # Se não houve update no profile (só newsletter), busca o atual
                prof_res = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
                if not prof_res.data:
                    raise HTTPException(status_code=404, detail="Perfil não encontrado")
                profile = prof_res.data[0]

            # Atualizar newsletter se solicitado
            if newsletter_opt_in is not None:
                try:
                    if newsletter_opt_in:
                        # Verificar se já existe registro
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
                                    "email": profile["email"],
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
                except Exception as e:
                    # Log erro mas não falha a request principal
                    print(f"Erro ao atualizar newsletter: {e}")

            # Retornar no formato esperado (com name ao invés de full_name)
            # Recarregar o status atual da newsletter para retornar corretamente
            current_newsletter_opt_in = False
            try:
                newsletter_res = (
                    self.supabase.table("newsletter_subscriptions")
                    .select("status")
                    .eq("user_id", user_id)
                    .eq("status", "subscribed")
                    .execute()
                )
                current_newsletter_opt_in = bool(newsletter_res.data)
            except Exception:
                pass

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

    async def list_users(self, limit: int = 50, offset: int = 0):
        """List all users (admin only)

        Args:
            limit: Maximum number of users to return (default: 50)
            offset: Number of users to skip (default: 0)
        """
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

            # Mapear full_name -> name e assegurar campos opcionais
            users = [
                {
                    "id": p["id"],
                    "email": p["email"],
                    "name": p.get("full_name") or "",
                    "role": p.get("role", "user"),
                    "avatar_url": p.get("avatar_url"),
                    "phone": p.get("phone"),
                    "document_type": p.get("document_type"),
                    "document_number": p.get("document_number"),
                    "status": p.get("status", "active"),
                    "created_at": p["created_at"],
                    # Campos adicionais não presentes por padrão
                    "confirmed_at": None,
                }
                for p in data
            ]

            return users
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao listar usuários",
            )

    async def update_role(self, target_user_id: str, role: str):
        try:
            if role not in {"user", "author", "admin", "premium"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role inválida",
                )
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
