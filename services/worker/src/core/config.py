from pydantic_settings import BaseSettings, SettingsConfigDict

# Default LLM pricing (USD per 1M tokens)
# Models with tiered pricing use a list of (max_tokens, input_price, output_price).
# max_tokens=None means "unlimited" (catch-all for tokens above previous tier).
DEFAULT_LLM_PRICING: dict[str, list[tuple[int | None, float, float]]] = {
    "gemini-3.1-pro-preview": [
        (200_000, 2.0, 12.0),   # <= 200k tokens
        (None, 4.0, 18.0),      # > 200k tokens
    ],
    "gemini-3.1-flash-lite-preview": [
        (None, 0.25, 1.50),
    ],
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
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    GEMINI_ENRICHMENT_MODEL: str = "gemini-3.1-flash-lite-preview"

    # Google Integration (for office jobs)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Worker
    PORT: int = 8001


settings = Settings()


# Per-feature Gemini model overrides. Features not listed here use GEMINI_MODEL as fallback.
GEMINI_MODEL_MAP: dict[str, str] = {
    "process_summary": "gemini-3.1-flash-lite-preview",
    "cnis_analysis": "gemini-3.1-pro-preview",
    "brief_scanner": "gemini-3.1-pro-preview",
}


def get_gemini_model(feature: str) -> str:
    """Get the Gemini model for a specific feature, falling back to GEMINI_MODEL."""
    return GEMINI_MODEL_MAP.get(feature, settings.GEMINI_MODEL)


def get_model_pricing(model: str, prompt_tokens: int = 0) -> dict[str, float]:
    """Get pricing for a model (USD per 1M tokens). Returns {"input": X, "output": Y}.

    For models with tiered pricing, uses prompt_tokens to select the correct tier.
    """
    tiers = DEFAULT_LLM_PRICING.get(model)
    if not tiers:
        return {"input": 0.0, "output": 0.0}

    for max_tokens, input_price, output_price in tiers:
        if max_tokens is None or prompt_tokens <= max_tokens:
            return {"input": input_price, "output": output_price}

    # Shouldn't reach here, but fallback to last tier
    _, input_price, output_price = tiers[-1]
    return {"input": input_price, "output": output_price}
