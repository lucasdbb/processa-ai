from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Internal Auth
    INTERNAL_TOKEN: str = ""

    # Database
    DATABASE_URL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Redis (for job queue)
    REDIS_URL: str = "redis://localhost:6379/0"
    JOBS_QUEUE_KEY: str = "jobs"
    JOB_STATUS_TTL_S: int = 86400

    # Google Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    ENCRYPTION_KEY: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Email
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM: str = ""
    SUPPORT_EMAIL: str = ""

    # WhatsApp (Twilio)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""  # e.g. "whatsapp:+14155238886"


settings = Settings()
