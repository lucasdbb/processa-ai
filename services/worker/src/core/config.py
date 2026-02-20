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

    # AI Providers
    OPENAI_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""

    # Google Integration (for office jobs)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Worker
    PORT: int = 8001

settings = Settings()
