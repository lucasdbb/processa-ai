from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Server
    PORT: int = 8080
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    # Supabase (for JWT validation)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Microservices
    CORE_API_BASE_URL: str = "http://localhost:8004"
    CORE_API_INTERNAL_TOKEN: str = "changeme"

    AI_WORKER_BASE_URL: str = "http://localhost:8001"
    AI_WORKER_INTERNAL_TOKEN: str = "changeme"

    CALC_ENGINE_BASE_URL: str = "http://localhost:8002"
    CALC_ENGINE_INTERNAL_TOKEN: str = "changeme"

    OFFICE_API_BASE_URL: str = "http://localhost:8003"
    OFFICE_API_INTERNAL_TOKEN: str = "changeme"

    BILLING_API_BASE_URL: str = "http://localhost:8005"
    BILLING_API_INTERNAL_TOKEN: str = "changeme"

    # Timeouts
    UPSTREAM_TIMEOUT_S: float = 300.0

    # CORS
    ALLOWED_ORIGINS: str = (
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    )


settings = Settings()
