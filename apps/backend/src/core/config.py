"""
Application configuration using environment variables
"""
import os

from dotenv import load_dotenv

# Load .env file if it exists (for local development)
load_dotenv()


class Settings:
    """Application settings loaded from environment variables"""

    def __init__(self):
        # Server Configuration
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        # Supabase Configuration
        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
        self.SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        # CORS Configuration
        self.FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
        allowed_origins_str = os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
        )
        self.ALLOWED_ORIGINS: list[str] = [
            origin.strip() for origin in allowed_origins_str.split(",")
        ]

        # SendGrid Configuration
        self.ADMIN_EMAIL: str | None = os.getenv("ADMIN_EMAIL")
        self.SENDGRID_API_KEY: str | None = os.getenv("SENDGRID_API_KEY")
        self.SENDGRID_FROM: str | None = os.getenv("SENDGRID_FROM")

        # Validate required fields
        if not self.SUPABASE_URL:
            raise ValueError("SUPABASE_URL environment variable is required")
        if not self.SUPABASE_ANON_KEY:
            raise ValueError("SUPABASE_ANON_KEY environment variable is required")
        if not self.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")


settings = Settings()
