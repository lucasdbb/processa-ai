from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_AI_BUCKET: str = "supabase-outputs"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    JOBS_QUEUE_KEY: str = "jobs"
    JOB_STATUS_TTL_S: int = 86400

    # n8n Integration (for AI jobs)
    N8N_BASE_URL: str = "http://localhost:5678"
    N8N_AUTH_USER: str = ""
    N8N_AUTH_PASSWORD: str = ""
    N8N_TIMEOUT_S: int = 120

    # Google Integration (for office jobs)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Callback URL for n8n progress updates
    AI_WORKER_CALLBACK_BASE_URL: str = ""
    PORT: int = 8001  # Used for callback URL generation


settings = Settings()
