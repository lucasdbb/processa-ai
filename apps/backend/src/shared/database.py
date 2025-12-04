"""
Supabase client configuration
"""
from supabase import Client, create_client

from src.core.config import settings

# Initialize Supabase client with service role key
# Note: Service role key bypasses RLS - use with caution
# For user-specific operations, use user's access token
supabase: Client = create_client(
    supabase_url=settings.SUPABASE_URL,
    supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
)


def get_supabase() -> Client:
    """
    Get Supabase client instance

    Returns:
        Client: Supabase client with service role key

    Note:
        This client uses service role key which bypasses RLS.
        Use authentication dependencies in routes to ensure proper access control.
    """
    return supabase
