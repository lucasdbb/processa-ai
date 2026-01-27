from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8004
    ENVIRONMENT: str = "development"

    # Internal Auth
    CORE_API_INTERNAL_TOKEN: str = "changeme"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_ENTERPRISE: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Email
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM: str = ""
    ADMIN_EMAIL: str = ""


settings = Settings()
