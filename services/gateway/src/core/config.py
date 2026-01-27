import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Server
    PORT: int = int(os.getenv("PORT", "8080"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Microservices URLs
    AI_WORKER_BASE_URL: str = os.getenv("AI_WORKER_BASE_URL", "http://localhost:8001")
    AI_WORKER_INTERNAL_TOKEN: str = os.getenv("AI_WORKER_INTERNAL_TOKEN", "dev-internal-token")
    
    CALC_ENGINE_BASE_URL: str = os.getenv("CALC_ENGINE_BASE_URL", "http://localhost:8002")
    CALC_ENGINE_INTERNAL_TOKEN: str = os.getenv("CALC_ENGINE_INTERNAL_TOKEN", "dev-internal-token")
    
    OFFICE_API_BASE_URL: str = os.getenv("OFFICE_API_BASE_URL", "http://localhost:8003")
    OFFICE_API_INTERNAL_TOKEN: str = os.getenv("OFFICE_API_INTERNAL_TOKEN", "dev-internal-token")

    # Timeouts
    UPSTREAM_TIMEOUT_S: float = float(os.getenv("UPSTREAM_TIMEOUT_S", "300"))

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
