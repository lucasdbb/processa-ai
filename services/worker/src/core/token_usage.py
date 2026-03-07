"""Token usage tracking for LLM calls."""

from __future__ import annotations

from dataclasses import dataclass

from src.core.config import get_model_pricing, settings


@dataclass
class TokenUsage:
    """Provider-agnostic token usage and cost tracking."""

    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "cost_usd": round(self.cost_usd, 6),
        }


def token_usage_from_gemini(usage_metadata: object, model: str | None = None) -> TokenUsage:
    """Build TokenUsage from a Gemini response's usage_metadata."""
    model = model or settings.GEMINI_MODEL
    prompt_tokens = getattr(usage_metadata, "prompt_token_count", 0) or 0
    completion_tokens = getattr(usage_metadata, "candidates_token_count", 0) or 0
    total_tokens = getattr(usage_metadata, "total_token_count", 0) or 0

    pricing = get_model_pricing(model, prompt_tokens)
    cost_usd = (
        (prompt_tokens / 1_000_000) * pricing["input"]
        + (completion_tokens / 1_000_000) * pricing["output"]
    )

    return TokenUsage(
        provider="gemini",
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
    )
