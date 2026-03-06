import json

from pydantic_settings import BaseSettings, SettingsConfigDict

# Default LLM pricing (USD per 1M tokens)
DEFAULT_LLM_PRICING: dict[str, dict[str, float]] = {
    "gemini-3.1-pro-preview": {"input": 2.0, "output": 12.0},
    "gemini-3.1-flash-lite-preview": {"input": 0.25, "output": 1.50},
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    DATABASE_URL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    JOBS_QUEUE_KEY: str = "jobs"
    JOB_STATUS_TTL_S: int = 86400

    # AI Providers
    OPENAI_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-pro-preview"

    # LLM Pricing overrides (JSON string, e.g. '{"gemini-3.0-pro": {"input": 2.0, "output": 15.0}}')
    LLM_PRICING_OVERRIDES: str = ""

    # Google Integration (for office jobs)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Worker
    PORT: int = 8001


settings = Settings()


def get_model_pricing(model: str) -> dict[str, float]:
    """Get pricing for a model (USD per 1M tokens). Returns {"input": X, "output": Y}."""
    pricing = {**DEFAULT_LLM_PRICING}
    if settings.LLM_PRICING_OVERRIDES:
        try:
            overrides = json.loads(settings.LLM_PRICING_OVERRIDES)
            if isinstance(overrides, dict):
                pricing.update(overrides)
        except json.JSONDecodeError:
            pass
    return pricing.get(model, {"input": 0.0, "output": 0.0})
