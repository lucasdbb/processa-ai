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
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_OUTPUTS_BUCKET: str = "supabase-outputs"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_PRO: str = ""
    STRIPE_PRICE_ID_ENTERPRISE: str = ""

    # Redis (for job queue)
    REDIS_URL: str = "redis://localhost:6379/0"
    JOBS_QUEUE_KEY: str = "jobs"
    JOB_STATUS_TTL_S: int = 86400

    # Google Integration
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/calendar/callback"
    ENCRYPTION_KEY: str = ""

    # n8n Integration
    N8N_BASE_URL: str = "http://localhost:5678"
    N8N_CNIS_WORKFLOW_ID: str = ""
    N8N_FILE_FIELD_NAME: str = "data"
    N8N_AUTH_USER: str = ""
    N8N_AUTH_PASSWORD: str = ""
    N8N_TIMEOUT_S: int = 120

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Email
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM: str = ""
    ADMIN_EMAIL: str = ""

    # Webhook
    WEBHOOK_BASE_URL: str = ""


settings = Settings()
