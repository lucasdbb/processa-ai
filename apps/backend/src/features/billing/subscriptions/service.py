from datetime import datetime, timezone
from urllib.parse import urlparse

import stripe
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger
from src.core.stripe_client import (
    create_checkout_session as stripe_create_checkout,
)
from src.core.stripe_client import (
    create_customer as stripe_create_customer,
)
from src.core.stripe_client import (
    create_portal_session as stripe_create_portal,
)
from src.core.stripe_client import (
    list_invoices as stripe_list_invoices,
)
from src.core.stripe_client import (
    retrieve_subscription as stripe_retrieve_subscription,
)
from src.core.stripe_client import get_subscription_period
from src.core.supabase import get_supabase


class SubscriptionsService:
    def __init__(self):
        self.supabase = get_supabase()
        self._allowed_prices_cache: set[str] | None = None
        self._cache_timestamp: float = 0

    def _get_allowed_price_ids(self) -> set[str]:
        """Get allowed Stripe price IDs from billing_plans table with caching."""
        import time

        # Cache for 5 minutes
        cache_ttl = 300
        current_time = time.time()

        if (
            self._allowed_prices_cache is not None
            and current_time - self._cache_timestamp < cache_ttl
        ):
            return self._allowed_prices_cache

        result = (
            self.supabase.table("billing_plans")
            .select("stripe_price_id")
            .not_.is_("stripe_price_id", "null")
            .execute()
        )

        prices = {
            row["stripe_price_id"] for row in (result.data or []) if row.get("stripe_price_id")
        }

        self._allowed_prices_cache = prices
        self._cache_timestamp = current_time

        return prices

    def _validate_price_id(self, price_id: str) -> None:
        """Validate that the price_id is allowed."""
        allowed = self._get_allowed_price_ids()

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Nenhum plano configurado",
            )

        if price_id not in allowed:
            logger.warning(f"Invalid price_id attempted: {price_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plano inválido",
            )

    def _validate_redirect_url(self, url: str | None) -> str | None:
        """Validate that redirect URL belongs to allowed domain."""
        if url is None:
            return None

        parsed = urlparse(url)
        frontend_parsed = urlparse(settings.FRONTEND_URL)

        # Only allow redirects to the frontend domain
        if parsed.netloc and parsed.netloc != frontend_parsed.netloc:
            logger.warning(f"Invalid redirect URL attempted: {url}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL de redirecionamento inválida",
            )

        # Ensure HTTPS in production
        if settings.ENVIRONMENT == "production" and parsed.scheme and parsed.scheme != "https":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL deve usar HTTPS",
            )

        return url

    async def get_or_create_customer(self, user_id: str) -> str:
        """Get existing Stripe customer or create new one."""
        # Check if user already has a subscription record with customer_id
        try:
            res = (
                self.supabase.table("subscriptions")
                .select("stripe_customer_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if res.data and res.data[0].get("stripe_customer_id"):
                return res.data[0]["stripe_customer_id"]
        except Exception:
            pass

        # Get user email from profiles
        try:
            profile_res = (
                self.supabase.table("profiles")
                .select("email, name")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            if not profile_res.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Perfil não encontrado",
                )
            profile = profile_res.data[0]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error fetching profile: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar perfil",
            )

        # Create Stripe customer (with retry)
        try:
            customer = stripe_create_customer(
                email=profile["email"],
                name=profile.get("name"),
                metadata={"user_id": user_id},
            )
        except stripe.StripeError as e:
            logger.error(f"Stripe error creating customer: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao criar cliente no Stripe",
            )

        # Save customer_id to subscriptions table
        try:
            self.supabase.table("subscriptions").upsert(
                {
                    "user_id": user_id,
                    "stripe_customer_id": customer.id,
                    "plan_id": "free",
                    "status": "none",
                },
                on_conflict="user_id",
            ).execute()
        except Exception as e:
            logger.warning(f"Failed to save customer_id: {e}")

        return customer.id

    async def create_checkout_session(
        self,
        user_id: str,
        price_id: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> dict:
        """Create a Stripe Checkout session."""
        # Validate price_id against allowed prices from database
        self._validate_price_id(price_id)

        # Validate redirect URLs
        success_url = self._validate_redirect_url(success_url)
        cancel_url = self._validate_redirect_url(cancel_url)

        # Check if user already has an active subscription
        existing_sub = await self.get_subscription(user_id)
        if existing_sub.get("status") in ("active", "trialing"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você já possui uma assinatura ativa. Use o portal para gerenciar.",
            )

        customer_id = await self.get_or_create_customer(user_id)

        success = success_url or f"{settings.FRONTEND_URL}/app/billing?success=true"
        cancel = cancel_url or f"{settings.FRONTEND_URL}/app/billing?canceled=true"

        try:
            session = stripe_create_checkout(
                customer=customer_id,
                price_id=price_id,
                success_url=success,
                cancel_url=cancel,
                metadata={"user_id": user_id},
            )
        except stripe.StripeError as e:
            logger.error(f"Stripe error creating checkout: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao criar sessão de checkout",
            )

        return {"checkout_url": session.url, "session_id": session.id}

    async def create_portal_session(self, user_id: str) -> dict:
        """Create a Stripe Customer Portal session."""
        try:
            res = (
                self.supabase.table("subscriptions")
                .select("stripe_customer_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not res.data or not res.data[0].get("stripe_customer_id"):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assinatura não encontrada",
                )
            customer_id = res.data[0]["stripe_customer_id"]
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar assinatura",
            )

        try:
            session = stripe_create_portal(
                customer=customer_id,
                return_url=f"{settings.FRONTEND_URL}/app/billing",
            )
        except stripe.StripeError as e:
            logger.error(f"Stripe error creating portal: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao criar portal de billing",
            )

        return {"portal_url": session.url}

    async def get_subscription(self, user_id: str) -> dict:
        """Get user's current subscription status."""
        try:
            res = (
                self.supabase.table("subscriptions")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not res.data:
                return {
                    "id": "",
                    "user_id": user_id,
                    "stripe_customer_id": None,
                    "stripe_subscription_id": None,
                    "plan_id": "free",
                    "status": "none",
                    "current_period_start": None,
                    "current_period_end": None,
                    "cancel_at_period_end": False,
                }
            sub = res.data[0]
            return {
                "id": str(sub.get("id", "")),
                "user_id": sub["user_id"],
                "stripe_customer_id": sub.get("stripe_customer_id"),
                "stripe_subscription_id": sub.get("stripe_subscription_id"),
                "plan_id": sub.get("plan_id", "free"),
                "status": sub.get("status", "none"),
                "current_period_start": sub.get("current_period_start"),
                "current_period_end": sub.get("current_period_end"),
                "cancel_at_period_end": sub.get("cancel_at_period_end", False),
            }
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar assinatura",
            )

    async def list_invoices(self, user_id: str, limit: int = 10) -> dict:
        """List user's invoices from Stripe."""
        try:
            res = (
                self.supabase.table("subscriptions")
                .select("stripe_customer_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if not res.data or not res.data[0].get("stripe_customer_id"):
                return {"invoices": [], "has_more": False}
            customer_id = res.data[0]["stripe_customer_id"]
        except Exception:
            return {"invoices": [], "has_more": False}

        try:
            invoices = stripe_list_invoices(customer=customer_id, limit=limit)
        except stripe.StripeError as e:
            logger.error(f"Stripe error listing invoices: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao buscar faturas",
            )

        items = []
        for inv in invoices.data:
            items.append(
                {
                    "id": inv.id,
                    "amount": inv.amount_paid,
                    "currency": inv.currency,
                    "status": inv.status,
                    "created": datetime.fromtimestamp(inv.created, tz=timezone.utc),
                    "invoice_url": inv.hosted_invoice_url,
                    "invoice_pdf": inv.invoice_pdf,
                }
            )

        return {"invoices": items, "has_more": invoices.has_more}

    async def sync_subscription(self, user_id: str) -> dict:
        """
        Sync local subscription state with Stripe.
        Useful for reconciliation after webhook failures or manual updates.
        """
        # Get local subscription record
        try:
            res = (
                self.supabase.table("subscriptions")
                .select("stripe_subscription_id, stripe_customer_id")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )

            if not res.data:
                return {
                    "synced": False,
                    "message": "No subscription record found",
                }

            local_sub = res.data[0]
            stripe_subscription_id = local_sub.get("stripe_subscription_id")

            if not stripe_subscription_id:
                return {
                    "synced": False,
                    "message": "No active Stripe subscription to sync",
                }

        except Exception as e:
            logger.error(f"Failed to fetch local subscription: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao buscar assinatura local",
            )

        # Fetch subscription from Stripe
        try:
            stripe_sub = stripe_retrieve_subscription(stripe_subscription_id)
        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve subscription from Stripe: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro ao buscar assinatura no Stripe",
            )

        # Get plan_id from price
        plan_id = self._get_plan_id_from_stripe_price(stripe_sub.items.data[0].price.id)
        period = get_subscription_period(stripe_sub)

        # Update local record with Stripe data
        try:
            self.supabase.table("subscriptions").update(
                {
                    "plan_id": plan_id,
                    "status": stripe_sub.status,
                    "current_period_start": datetime.fromtimestamp(
                        period["current_period_start"], tz=timezone.utc
                    ).isoformat(),
                    "current_period_end": datetime.fromtimestamp(
                        period["current_period_end"], tz=timezone.utc
                    ).isoformat(),
                    "cancel_at_period_end": stripe_sub.cancel_at_period_end or False,
                }
            ).eq("user_id", user_id).execute()

            logger.info(f"Synced subscription for user {user_id}")

            return {
                "synced": True,
                "plan_id": plan_id,
                "status": stripe_sub.status,
                "current_period_end": datetime.fromtimestamp(
                    period["current_period_end"], tz=timezone.utc
                ).isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro ao atualizar assinatura",
            )

    def _get_plan_id_from_stripe_price(self, price_id: str) -> str:
        """Map Stripe price_id to internal plan_id using database lookup."""
        try:
            result = (
                self.supabase.table("billing_plans")
                .select("slug")
                .eq("stripe_price_id", price_id)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                return result.data[0]["slug"]
        except Exception as e:
            logger.error(f"Failed to lookup plan for price {price_id}: {e}")

        logger.warning(f"Unknown price_id: {price_id}, defaulting to free")
        return "free"


subscriptions_service = SubscriptionsService()
