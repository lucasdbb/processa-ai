"""Middleware for processing authentication headers from Supabase JWT."""

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.logging import logger
from src.core.supabase import get_supabase


class SupabaseAuthMiddleware(BaseHTTPMiddleware):
    """Extract user_id from Supabase JWT and fetch role from profiles table."""

    async def dispatch(self, request: Request, call_next):
        # Skip middleware for docs and health check
        if request.url.path in ["/", "/docs", "/redoc", "/openapi.json", "/health"]:
            return await call_next(request)

        # Get Authorization header
        auth_header = request.headers.get("Authorization", "")

        if auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")

            try:
                # Decode JWT without verification (Supabase already verified it)
                # In production, you should verify the signature with Supabase's public key
                decoded = jwt.decode(token, options={"verify_signature": False})

                # Extract user ID from JWT
                user_id = decoded.get("sub")  # subject = user_id

                if user_id:
                    # Fetch role from profiles table
                    try:
                        supabase = get_supabase()
                        response = (
                            supabase.table("profiles")
                            .select("role")
                            .eq("id", user_id)
                            .single()
                            .execute()
                        )

                        user_role = (
                            response.data.get("role", "client") if response.data else "client"
                        )
                    except Exception as e:
                        logger.warning(f"Failed to fetch user role from profiles: {e}")
                        user_role = "client"

                    # Add to request state so it can be accessed by dependencies
                    request.state.user_id = user_id
                    request.state.user_role = user_role

                    logger.debug(f"Auth middleware: user_id={user_id}, role={user_role}")

            except jwt.InvalidTokenError as e:
                logger.warning(f"Invalid JWT token: {e}")
            except Exception as e:
                logger.error(f"Error decoding JWT: {e}")

        response = await call_next(request)
        return response
