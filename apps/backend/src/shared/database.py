from src.core.config import settings
from supabase import Client, create_client

supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
)


def get_supabase() -> Client:
    return supabase
