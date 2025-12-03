"""
Authentication service with Supabase integration
"""
from fastapi import HTTPException, status

from src.core.config import settings
from src.features.auth.schemas import ResetPassword, UserLogin, UserRegister
from src.shared.database import get_supabase


class AuthService:
    """Authentication service"""

    def __init__(self):
        self.supabase = get_supabase()

    async def register(self, user_data: UserRegister):
        """Register a new user with Supabase Auth

        Note: Profile is automatically created via database trigger (handle_new_user)
        """
        try:
            # Sign up user with Supabase Auth
            response = self.supabase.auth.sign_up({
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "full_name": user_data.full_name,
                        "role": "user",  # Default role
                    }
                }
            })

            if not response.user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Falha ao criar usuário",
                )

            # Check if email confirmation is required
            if response.session is None:
                # Email confirmation required
                return {
                    "message": "Usuário criado com sucesso! Verifique seu e-mail para confirmar.",
                    "email_confirmation_required": True,
                    "user": {
                        "id": response.user.id,
                        "email": response.user.email,
                        "full_name": user_data.full_name,
                    },
                }

            # Profile is auto-created by database trigger
            # User is auto-confirmed, return tokens
            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": response.session.expires_in,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "full_name": user_data.full_name,
                    "role": "user",
                },
            }
        except HTTPException:
            raise
        except Exception as e:
            # Better error handling
            error_msg = str(e)
            if "already registered" in error_msg.lower() or "duplicate" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="E-mail já cadastrado",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erro ao criar usuário: {error_msg}",
            )

    async def login(self, user_data: UserLogin):
        """Login user with Supabase Auth"""
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": user_data.email,
                "password": user_data.password,
            })

            if not response.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciais inválidas",
                )

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": response.session.expires_in,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                    "role": response.user.user_metadata.get("role", "user"),
                },
            }
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciais inválidas",
            )

    async def refresh_token(self, refresh_token: str):
        """Refresh access token"""
        try:
            response = self.supabase.auth.refresh_session(refresh_token)

            if not response.session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token inválido",
                )

            return {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token,
                "token_type": "bearer",
                "expires_in": response.session.expires_in,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email,
                },
            }
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido",
            )

    async def forgot_password(self, email: str):
        """Send password reset email"""
        try:
            self.supabase.auth.reset_password_email(email)
            return {"message": "E-mail de recuperação enviado com sucesso"}
        except Exception:
            # Don't reveal if email exists or not
            return {"message": "E-mail de recuperação enviado com sucesso"}

    async def reset_password(self, data: ResetPassword):
        """Reset user password

        The token received is already a valid access_token from Supabase recovery link.
        We use it to authenticate the password update request.
        """
        try:
            from supabase import create_client

            # Initialize client with publishable (anon) key
            user_supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)

            # Set the session explicitly to ensure auth context as the recovering user
            user_supabase.auth.set_session(access_token=data.token, refresh_token="")

            # Update password for the authenticated user
            user_supabase.auth.update_user({"password": data.new_password})

            return {"message": "Senha redefinida com sucesso"}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error resetting password: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token inválido ou expirado",
            )
