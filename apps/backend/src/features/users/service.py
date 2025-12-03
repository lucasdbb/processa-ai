"""
User service
"""
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
            profile_response = self.supabase.table("profiles").select(
                "id, email, full_name, role, avatar_url, created_at"
            ).eq("id", user_id).execute()

            if not profile_response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Perfil não encontrado",
                )

            profile = profile_response.data[0]

            # Buscar dados do auth.users para pegar confirmed_at
            try:
                auth_response = self.supabase.auth.admin.get_user_by_id(user_id)
                confirmed_at = auth_response.user.confirmed_at if auth_response.user else None
            except Exception:
                confirmed_at = None

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

            if not update_data:
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
            if "documentType" in update_data:
                db_update["document_type"] = update_data["documentType"]
            if "documentNumber" in update_data:
                db_update["document_number"] = update_data["documentNumber"]

            response = (
                self.supabase.table("profiles")
                .update(db_update)
                .eq("id", user_id)
                .execute()
            )

            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Perfil não encontrado",
                )

            # Retornar no formato esperado (com name ao invés de full_name)
            profile = response.data[0]
            return {
                "id": profile["id"],
                "email": profile["email"],
                "name": profile.get("full_name", profile["email"].split("@")[0]),
                "role": profile.get("role", "user"),
                "avatar_url": profile.get("avatar_url"),
                "phone": profile.get("phone"),
                "document_type": profile.get("document_type"),
                "document_number": profile.get("document_number"),
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
                "document_type, document_number, created_at"
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
                    "name": p.get("full_name") or p["email"].split("@")[0],
                    "role": p.get("role", "user"),
                    "avatar_url": p.get("avatar_url"),
                    "phone": p.get("phone"),
                    "document_type": p.get("document_type"),
                    "document_number": p.get("document_number"),
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
