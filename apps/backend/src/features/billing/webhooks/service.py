from datetime import datetime, timezone

import stripe
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger
from src.core.supabase import get_supabase

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class WebhooksService:
    def __init__(self):
        self.supabase = get_supabase()

    async def handle_webhook(self, payload: bytes, signature: str) -> dict:
        """Handle Stripe webhook events."""
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                settings.STRIPE_WEBHOOK_SECRET,
            )
        except stripe.SignatureVerificationError:
            logger.warning("Invalid Stripe webhook signature")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid signature",
            )
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payload",
            )

        event_type = event["type"]
        data = event["data"]["object"]

        logger.info(f"Processing Stripe webhook: {event_type}")

        try:
            if event_type == "checkout.session.completed":
                await self._handle_checkout_completed(data)
            elif event_type == "invoice.paid":
                await self._handle_invoice_paid(data)
            elif event_type == "invoice.payment_failed":
                await self._handle_invoice_failed(data)
            elif event_type == "customer.subscription.updated":
                await self._handle_subscription_updated(data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_deleted(data)
            else:
                logger.debug(f"Unhandled webhook event type: {event_type}")
        except Exception as e:
            logger.error(f"Error processing webhook {event_type}: {e}")
            # Don't raise - return success to Stripe to avoid retries
            # Log the error for investigation

        return {"received": True}

    async def _handle_checkout_completed(self, session: dict) -> None:
        """Handle checkout.session.completed event."""
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        user_id = session.get("metadata", {}).get("user_id")

        if not customer_id or not subscription_id:
            logger.warning("checkout.session.completed missing customer or subscription")
            return

        # Get subscription details from Stripe
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve subscription: {e}")
            return

        plan_id = self._get_plan_id_from_price(subscription["items"]["data"][0]["price"]["id"])

        try:
            # Update subscription
            self.supabase.table("subscriptions").upsert(
                {
                    "user_id": user_id,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                    "plan_id": plan_id,
                    "status": subscription["status"],
                    "current_period_start": datetime.fromtimestamp(
                        subscription["current_period_start"], tz=timezone.utc
                    ).isoformat(),
                    "current_period_end": datetime.fromtimestamp(
                        subscription["current_period_end"], tz=timezone.utc
                    ).isoformat(),
                    "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
                },
                on_conflict="user_id",
            ).execute()

            # Grant credits based on plan
            await self._grant_plan_credits(user_id, plan_id)

            logger.info(f"Subscription activated for user {user_id}, plan: {plan_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")

    async def _handle_invoice_paid(self, invoice: dict) -> None:
        """Handle invoice.paid event - renew subscription."""
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return

        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve subscription for invoice.paid: {e}")
            return

        try:
            # Update subscription status
            result = (
                self.supabase.table("subscriptions")
                .update(
                    {
                        "status": "active",
                        "current_period_start": datetime.fromtimestamp(
                            subscription["current_period_start"], tz=timezone.utc
                        ).isoformat(),
                        "current_period_end": datetime.fromtimestamp(
                            subscription["current_period_end"], tz=timezone.utc
                        ).isoformat(),
                    }
                )
                .eq("stripe_subscription_id", subscription_id)
                .execute()
            )

            # Reset monthly credits if it's a renewal
            if result.data and len(result.data) > 0:
                user_id = result.data[0].get("user_id")
                plan_id = result.data[0].get("plan_id")
                if user_id and plan_id:
                    await self._reset_monthly_credits(user_id, plan_id)

            logger.info(f"Subscription renewed: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription on invoice.paid: {e}")

    async def _handle_invoice_failed(self, invoice: dict) -> None:
        """Handle invoice.payment_failed event."""
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            return

        try:
            self.supabase.table("subscriptions").update({"status": "past_due"}).eq(
                "stripe_subscription_id", subscription_id
            ).execute()
            logger.warning(f"Subscription payment failed: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription on invoice.failed: {e}")

    async def _handle_subscription_updated(self, subscription: dict) -> None:
        """Handle customer.subscription.updated event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            return

        plan_id = self._get_plan_id_from_price(subscription["items"]["data"][0]["price"]["id"])

        try:
            self.supabase.table("subscriptions").update(
                {
                    "plan_id": plan_id,
                    "status": subscription["status"],
                    "current_period_start": datetime.fromtimestamp(
                        subscription["current_period_start"], tz=timezone.utc
                    ).isoformat(),
                    "current_period_end": datetime.fromtimestamp(
                        subscription["current_period_end"], tz=timezone.utc
                    ).isoformat(),
                    "cancel_at_period_end": subscription.get("cancel_at_period_end", False),
                }
            ).eq("stripe_subscription_id", subscription_id).execute()
            logger.info(f"Subscription updated: {subscription_id}, plan: {plan_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")

    async def _handle_subscription_deleted(self, subscription: dict) -> None:
        """Handle customer.subscription.deleted event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            return

        try:
            self.supabase.table("subscriptions").update(
                {
                    "status": "canceled",
                    "plan_id": "free",
                    "stripe_subscription_id": None,
                }
            ).eq("stripe_subscription_id", subscription_id).execute()
            logger.info(f"Subscription canceled: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription on delete: {e}")

    async def _grant_plan_credits(self, user_id: str, plan_id: str) -> None:
        """Grant credits to user based on their plan."""
        try:
            # Get plan details to know how many credits to grant
            plan_result = (
                self.supabase.table("billing_plans")
                .select("monthly_credits")
                .eq("slug", plan_id)
                .single()
                .execute()
            )

            if not plan_result.data:
                logger.warning(f"Plan not found: {plan_id}")
                return

            monthly_credits = plan_result.data.get("monthly_credits", 0)

            if monthly_credits > 0:
                # Use PostgreSQL function to grant credits
                self.supabase.rpc(
                    "grant_credits_to_user",
                    {
                        "p_user_id": user_id,
                        "p_amount": monthly_credits,
                        "p_reason": f"subscription_activation_{plan_id}",
                    },
                ).execute()
                logger.info(f"Granted {monthly_credits} credits to user {user_id}")
        except Exception as e:
            logger.error(f"Failed to grant credits: {e}")

    async def _reset_monthly_credits(self, user_id: str, plan_id: str) -> None:
        """Reset monthly credits for user based on their plan."""
        try:
            # Get plan details
            plan_result = (
                self.supabase.table("billing_plans")
                .select("monthly_credits")
                .eq("slug", plan_id)
                .single()
                .execute()
            )

            if not plan_result.data:
                logger.warning(f"Plan not found: {plan_id}")
                return

            monthly_credits = plan_result.data.get("monthly_credits", 0)

            if monthly_credits > 0:
                # Use PostgreSQL function to reset credits
                self.supabase.rpc(
                    "reset_monthly_credits", {"p_user_id": user_id, "p_new_amount": monthly_credits}
                ).execute()
                logger.info(f"Reset monthly credits to {monthly_credits} for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to reset monthly credits: {e}")

    def _get_plan_id_from_price(self, price_id: str) -> str:
        """Map Stripe price_id to internal plan_id."""
        if price_id == settings.STRIPE_PRICE_ID_PRO:
            return "pro"
        elif price_id == settings.STRIPE_PRICE_ID_ENTERPRISE:
            return "enterprise"
        return "free"


webhooks_service = WebhooksService()
