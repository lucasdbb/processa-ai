from datetime import datetime, timezone

import stripe
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger
from src.core.supabase import get_supabase

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class SubscriptionsService:
    def __init__(self):
        self.supabase = get_supabase()

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

        # Create Stripe customer
        try:
            customer = stripe.Customer.create(
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
        customer_id = await self.get_or_create_customer(user_id)

        success = success_url or f"{settings.FRONTEND_URL}/app/billing?success=true"
        cancel = cancel_url or f"{settings.FRONTEND_URL}/app/billing?canceled=true"

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
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
            session = stripe.billing_portal.Session.create(
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
            invoices = stripe.Invoice.list(customer=customer_id, limit=limit)
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


subscriptions_service = SubscriptionsService()
