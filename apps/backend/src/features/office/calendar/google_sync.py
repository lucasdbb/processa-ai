import json
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from src.core.config import settings
from src.core.db import get_pool
from src.core.encryption import decrypt_token, encrypt_token
from src.core.logging import logger


class GoogleCalendarSync:
    """Handles Google Calendar OAuth2 and one-way sync (push only)."""

    SCOPES = [
        "https://www.googleapis.com/auth/calendar.events",
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI

    async def get_auth_url(self, user_id: str) -> dict[str, str]:
        """Generate OAuth2 authorization URL.

        Args:
            user_id: User ID to be encrypted in state parameter

        Returns:
            Dict with auth_url and state
        """
        try:
            # Create OAuth2 flow
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self.redirect_uri],
                    }
                },
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri,
            )

            auth_url, _ = flow.authorization_url(
                access_type="offline",
                prompt="consent",  # Force consent screen to get refresh token
            )

            # Encrypt user_id + code_verifier together in state so the callback
            # can reconstruct the PKCE verifier that Google expects.
            state_payload = json.dumps({
                "user_id": user_id,
                "code_verifier": flow.code_verifier,
            })
            encrypted_state = encrypt_token(state_payload)

            # Replace the auto-generated state in the URL with our encrypted one
            parsed = urlparse(auth_url)
            params = parse_qs(parsed.query, keep_blank_values=True)
            params["state"] = [encrypted_state]
            new_query = urlencode({k: v[0] for k, v in params.items()})
            auth_url = urlunparse(parsed._replace(query=new_query))

            logger.info(f"Generated auth URL for user {user_id}")
            return {"auth_url": auth_url, "state": encrypted_state}

        except Exception as e:
            logger.error(f"Error generating auth URL: {e}")
            raise

    async def handle_callback(self, code: str, state: str) -> dict[str, Any]:
        """Handle OAuth2 callback and store tokens.

        Args:
            code: Authorization code from Google
            state: Encrypted state containing user_id and code_verifier

        Returns:
            Dict with success status and user info
        """
        try:
            # Decrypt state to get user_id and code_verifier
            state_raw = decrypt_token(state)
            try:
                state_data = json.loads(state_raw)
                user_id = state_data["user_id"]
                code_verifier = state_data.get("code_verifier")
            except (json.JSONDecodeError, KeyError):
                # Fallback for legacy state format (plain user_id)
                user_id = state_raw
                code_verifier = None

            logger.info(f"Processing OAuth callback for user {user_id}")

            # Exchange code for tokens
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self.redirect_uri],
                    }
                },
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri,
            )

            # Restore the PKCE code_verifier so the token exchange succeeds
            flow.code_verifier = code_verifier

            flow.fetch_token(code=code)
            credentials = flow.credentials

            # Get user email via OAuth2 userinfo (uses automatically granted scopes)
            oauth2_service = build("oauth2", "v2", credentials=credentials)
            user_info = oauth2_service.userinfo().get().execute()
            user_email = user_info.get("email", "")

            # Calculate token expiry
            expires_at = datetime.now(timezone.utc)
            if credentials.expiry:
                expires_at = credentials.expiry

            # Encrypt tokens
            access_token_encrypted = encrypt_token(credentials.token)
            refresh_token_encrypted = (
                encrypt_token(credentials.refresh_token) if credentials.refresh_token else None
            )

            # Store in database (delete old + insert new)
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        "DELETE FROM office_api.google_connections WHERE user_id = %s",
                        (user_id,),
                    )
                    await cur.execute(
                        """
                        INSERT INTO office_api.google_connections (
                            user_id, email, access_token_encrypted,
                            refresh_token_encrypted, token_expires_at,
                            scopes, is_active
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            user_id,
                            user_email,
                            access_token_encrypted,
                            refresh_token_encrypted,
                            expires_at,
                            self.SCOPES,
                            True,
                        ),
                    )
                    await conn.commit()

            logger.info(f"Successfully stored Google connection for user {user_id}")
            return {
                "success": True,
                "user_id": user_id,
                "email": user_email,
                "expires_at": expires_at,
            }

        except Exception as e:
            logger.error(f"Error handling OAuth callback: {e}")
            raise

    async def get_connection_status(self, user_id: str) -> dict[str, Any]:
        """Check if user has active Google Calendar connection.

        Args:
            user_id: User ID

        Returns:
            Dict with connection status
        """
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT email, token_expires_at, scopes, is_active
                        FROM office_api.google_connections
                        WHERE user_id = %s AND is_active = TRUE
                        """,
                        (user_id,),
                    )
                    row = await cur.fetchone()

                    if not row:
                        return {"connected": False, "email": None, "expires_at": None, "scopes": []}

                    return {
                        "connected": True,
                        "email": row[0],
                        "expires_at": row[1],
                        "scopes": row[2] or [],
                    }

        except Exception as e:
            logger.error(f"Error getting connection status: {e}")
            raise

    async def _get_valid_credentials(self, user_id: str) -> Credentials | None:
        """Get valid credentials for user, refreshing if necessary.

        Args:
            user_id: User ID

        Returns:
            Valid Credentials object or None if not connected
        """
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT access_token_encrypted, refresh_token_encrypted,
                               token_expires_at
                        FROM office_api.google_connections
                        WHERE user_id = %s AND is_active = TRUE
                        """,
                        (user_id,),
                    )
                    row = await cur.fetchone()

                    if not row:
                        logger.warning(f"No active Google connection for user {user_id}")
                        return None

                    access_token = decrypt_token(row[0])
                    refresh_token = decrypt_token(row[1]) if row[1] else None
                    expires_at = row[2]

                    # Create credentials
                    credentials = Credentials(
                        token=access_token,
                        refresh_token=refresh_token,
                        token_uri="https://oauth2.googleapis.com/token",
                        client_id=self.client_id,
                        client_secret=self.client_secret,
                        scopes=self.SCOPES,
                    )

                    # Set expiry (strip timezone: google-auth compares with utcnow() which is naive)
                    if expires_at:
                        credentials.expiry = (
                            expires_at.replace(tzinfo=None) if expires_at.tzinfo else expires_at
                        )

                    # Refresh if expired
                    if credentials.expired and credentials.refresh_token:
                        logger.info(f"Refreshing expired token for user {user_id}")
                        credentials.refresh(Request())

                        # Update tokens in database
                        new_access_token = encrypt_token(credentials.token)
                        new_expires_at = credentials.expiry

                        await cur.execute(
                            """
                            UPDATE office_api.google_connections
                            SET access_token_encrypted = %s,
                                token_expires_at = %s,
                                updated_at = NOW()
                            WHERE user_id = %s
                            """,
                            (new_access_token, new_expires_at, user_id),
                        )
                        await conn.commit()

                    return credentials

        except Exception as e:
            logger.error(f"Error getting valid credentials: {e}")
            raise

    async def push_events_to_google(self, user_id: str) -> dict[str, Any]:
        """Push pending events to Google Calendar (one-way sync).

        Args:
            user_id: User ID

        Returns:
            Dict with sync results
        """
        events_added = 0
        events_updated = 0
        errors = []

        try:
            # Get valid credentials
            credentials = await self._get_valid_credentials(user_id)
            if not credentials:
                return {
                    "success": False,
                    "events_added": 0,
                    "events_updated": 0,
                    "message": "No active Google Calendar connection",
                }

            # Build Calendar service
            service = build("calendar", "v3", credentials=credentials)

            # Get events with pending_sync status
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        SELECT id, google_event_id, title, description, location,
                               start_at, end_at, all_day, reminder_minutes
                        FROM office_api.events
                        WHERE user_id = %s
                          AND sync_status = 'pending_sync'
                          AND source = 'local'
                        ORDER BY created_at DESC
                        """,
                        (user_id,),
                    )
                    rows = await cur.fetchall()

                    for row in rows:
                        event_id = row[0]
                        google_event_id = row[1]
                        title = row[2]
                        description = row[3]
                        location = row[4]
                        start_at = row[5]
                        end_at = row[6]
                        all_day = row[7]
                        reminder_minutes = row[8] or []

                        try:
                            # Build Google Calendar event
                            event_body = {
                                "summary": title,
                                "description": description or "",
                                "location": location or "",
                            }

                            # Handle all-day events
                            if all_day:
                                event_body["start"] = {"date": start_at.strftime("%Y-%m-%d")}
                                event_body["end"] = {"date": end_at.strftime("%Y-%m-%d")}
                            else:
                                event_body["start"] = {
                                    "dateTime": start_at.isoformat(),
                                    "timeZone": "America/Sao_Paulo",
                                }
                                event_body["end"] = {
                                    "dateTime": end_at.isoformat(),
                                    "timeZone": "America/Sao_Paulo",
                                }

                            # Add reminders
                            if reminder_minutes:
                                event_body["reminders"] = {
                                    "useDefault": False,
                                    "overrides": [
                                        {"method": "popup", "minutes": minutes}
                                        for minutes in reminder_minutes
                                    ],
                                }

                            # Create or update event in Google Calendar
                            if google_event_id:
                                # Update existing event
                                service.events().update(
                                    calendarId="primary",
                                    eventId=google_event_id,
                                    body=event_body,
                                ).execute()
                                events_updated += 1
                            else:
                                # Create new event
                                created_event = (
                                    service.events()
                                    .insert(calendarId="primary", body=event_body)
                                    .execute()
                                )
                                google_event_id = created_event["id"]
                                events_added += 1

                            # Update local event with sync status
                            await cur.execute(
                                """
                                UPDATE office_api.events
                                SET sync_status = 'synced',
                                    google_event_id = %s,
                                    updated_at = NOW()
                                WHERE id = %s
                                """,
                                (google_event_id, event_id),
                            )

                        except Exception as e:
                            logger.error(f"Error syncing event {event_id}: {e}")
                            errors.append(str(e))

                    await conn.commit()

            message = f"Synced {events_added + events_updated} events"
            if errors:
                message += f" with {len(errors)} errors"

            logger.info(
                f"Push sync completed for user {user_id}: "
                f"{events_added} added, {events_updated} updated"
            )

            return {
                "success": True,
                "events_added": events_added,
                "events_updated": events_updated,
                "events_deleted": 0,
                "message": message,
            }

        except Exception as e:
            logger.error(f"Error pushing events to Google: {e}")
            return {
                "success": False,
                "events_added": events_added,
                "events_updated": events_updated,
                "events_deleted": 0,
                "message": f"Sync failed: {str(e)}",
            }

    async def delete_event_from_google(self, user_id: str, google_event_id: str) -> bool:
        """Delete an event from Google Calendar.

        Args:
            user_id: User ID
            google_event_id: Google Calendar event ID

        Returns:
            True if deleted successfully, False if not connected or failed
        """
        try:
            # Get valid credentials
            credentials = await self._get_valid_credentials(user_id)
            if not credentials:
                logger.warning(f"Cannot delete from Google: no connection for user {user_id}")
                return False

            # Build Calendar service
            service = build("calendar", "v3", credentials=credentials)

            # Delete event from Google Calendar
            service.events().delete(calendarId="primary", eventId=google_event_id).execute()

            logger.info(f"Deleted event {google_event_id} from Google Calendar for user {user_id}")
            return True

        except Exception as e:
            # Log but don't raise - deletion should succeed locally even if Google fails
            logger.error(f"Error deleting event {google_event_id} from Google Calendar: {e}")
            return False

    async def disconnect(self, user_id: str) -> bool:
        """Disconnect Google Calendar integration.

        Args:
            user_id: User ID

        Returns:
            True if disconnected successfully
        """
        try:
            pool = await get_pool()
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(
                        """
                        DELETE FROM office_api.google_connections
                        WHERE user_id = %s
                        """,
                        (user_id,),
                    )
                    await conn.commit()

            logger.info(f"Disconnected Google Calendar for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error disconnecting Google Calendar: {e}")
            raise


# Singleton instance
google_sync_service = GoogleCalendarSync()
