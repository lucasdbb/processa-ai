import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self):
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.PORT: int = int(os.getenv("PORT", "8001"))
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

        self.DATABASE_URL: str = (os.getenv("DATABASE_URL") or "").strip()

        self.AI_WORKER_INTERNAL_TOKEN: str = os.getenv("AI_WORKER_INTERNAL_TOKEN", "")

        self.N8N_BASE_URL: str = os.getenv("N8N_BASE_URL", "http://localhost:5678")
        self.N8N_AUTH_USER: str | None = os.getenv("N8N_AUTH_USER")
        self.N8N_AUTH_PASSWORD: str | None = os.getenv("N8N_AUTH_PASSWORD")
        self.N8N_FILE_FIELD_NAME: str = os.getenv("N8N_FILE_FIELD_NAME", "data")
        self.N8N_TIMEOUT_S: float = float(os.getenv("N8N_TIMEOUT_S", "120"))

        self.N8N_CNIS_WORKFLOW_ID: str = os.getenv("N8N_CNIS_WORKFLOW_ID")

        self.SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
        self.SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.SUPABASE_OUTPUTS_BUCKET: str = os.getenv("SUPABASE_OUTPUTS_BUCKET", "")

        self.REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.JOBS_QUEUE_KEY: str = os.getenv("JOBS_QUEUE_KEY", "jobs")
        self.JOB_STATUS_TTL_S: int = int(os.getenv("JOB_STATUS_TTL_S", "86400"))

        if not self.AI_WORKER_INTERNAL_TOKEN:
            raise ValueError("AI_WORKER_INTERNAL_TOKEN environment variable is required")

        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable is required")


settings = Settings()
