import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        # Server
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("PORT", "8003"))
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        # Database
        self.DATABASE_URL: str = (os.getenv("DATABASE_URL") or "").strip()

        # Redis
        self.REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/2")

        # Internal Auth
        self.OFFICE_API_INTERNAL_TOKEN: str = os.getenv("OFFICE_API_INTERNAL_TOKEN", "")

        # Google OAuth
        self.GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
        self.GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
        self.GOOGLE_REDIRECT_URI: str = os.getenv(
            "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/office/calendar/callback"
        )

        # Encryption
        self.ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

        # Supabase
        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

        # Webhooks
        self.WEBHOOK_BASE_URL: str = os.getenv("WEBHOOK_BASE_URL", "")

        # Validation
        if not self.OFFICE_API_INTERNAL_TOKEN:
            raise ValueError("OFFICE_API_INTERNAL_TOKEN environment variable is required")

        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")


settings = Settings()
