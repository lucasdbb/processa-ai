import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("PORT", "8002"))
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        self.DATABASE_URL: str = (os.getenv("DATABASE_URL") or "").strip()

        self.CALC_ENGINE_INTERNAL_TOKEN: str = os.getenv("CALC_ENGINE_INTERNAL_TOKEN", "")

        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.SUPABASE_OUTPUTS_BUCKET: str = os.getenv("SUPABASE_OUTPUTS_BUCKET", "")

        if not self.CALC_ENGINE_INTERNAL_TOKEN:
            raise ValueError("CALC_ENGINE_INTERNAL_TOKEN environment variable is required")
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")


settings = Settings()
