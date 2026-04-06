from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Internal Auth
    INTERNAL_TOKEN: str = ""

    # Supabase JWT verification
    SUPABASE_JWT_SECRET: str = ""

    @model_validator(mode="after")
    def validate_required_secrets(self):
        if self.ENVIRONMENT != "development":
            if not self.INTERNAL_TOKEN:
                raise ValueError("INTERNAL_TOKEN must be set in non-development environments")
            if not self.SUPABASE_JWT_SECRET:
                raise ValueError("SUPABASE_JWT_SECRET must be set in non-development environments")
            if not self.DATABASE_URL:
                raise ValueError("DATABASE_URL must be set in non-development environments")
            if not self.SUPABASE_URL:
                raise ValueError("SUPABASE_URL must be set in non-development environments")
            if not self.SUPABASE_SERVICE_ROLE_KEY:
                raise ValueError(
                    "SUPABASE_SERVICE_ROLE_KEY must be set in non-development environments"
                )
            if not self.STRIPE_SECRET_KEY:
                raise ValueError("STRIPE_SECRET_KEY must be set in non-development environments")
            if not self.STRIPE_WEBHOOK_SECRET:
                raise ValueError(
                    "STRIPE_WEBHOOK_SECRET must be set in non-development environments"
                )
            if "localhost" in self.ALLOWED_ORIGINS:
                raise ValueError(
                    "ALLOWED_ORIGINS must not contain localhost in non-development environments"
                )
        return self

    # Database
    DATABASE_URL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Google Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    ENCRYPTION_KEY: str = ""

    # URLs
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Email
    BREVO_API_KEY: str = ""
    BREVO_FROM: str = ""
    BREVO_FROM_NAME: str = "Contato - Processa AI"
    EMAIL_LOGO_URL: str = "https://www.processai.app.br/logo_light.png"
    SUPPORT_EMAIL: str = ""

    # WhatsApp (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""  # e.g. "whatsapp:+14155238886"

    # Gemini (Chat + Embeddings)
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-3.1-flash-lite-preview"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # DataJUD (API Pública CNJ)
    DATAJUD_API_KEY: str = ""


settings = Settings()
