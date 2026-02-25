from datetime import datetime, timezone

import stripe
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.email import (
    send_dispute_alert,
    send_payment_action_required,
    send_payment_failed,
    send_subscription_canceled,
    send_subscription_welcome,
)
from src.core.logging import logger
from src.core.stripe_client import (
    retrieve_charge,
    retrieve_invoice,
    retrieve_subscription,
)
from src.core.supabase import get_supabase


class TransientError(Exception):
    """Error that should trigger a Stripe retry (e.g., database temporarily unavailable)."""

    pass


class PermanentError(Exception):
    """Error that should NOT trigger a retry - logged but acknowledged to Stripe."""

    pass


class WebhooksService:
    def __init__(self):
        self.supabase = get_supabase()

    def _is_event_processed(self, event_id: str) -> bool:
        """Check if event was already processed (idempotency check)."""
        try:
            result = (
                self.supabase.table("stripe_webhook_events")
                .select("event_id, status")
                .eq("event_id", event_id)
                .limit(1)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            logger.error(f"Failed to check event idempotency: {e}")
            # On error, assume not processed to avoid missing events
            return False

    def _record_event(
        self,
        event_id: str,
        event_type: str,
        event_status: str = "processed",
        error_message: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        """Record a processed webhook event for idempotency."""
        try:
            self.supabase.table("stripe_webhook_events").upsert(
                {
                    "event_id": event_id,
                    "event_type": event_type,
                    "status": event_status,
                    "error_message": error_message,
                    "metadata": metadata or {},
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="event_id",
            ).execute()
        except Exception as e:
            logger.error(f"Failed to record webhook event: {e}")

    async def handle_webhook(self, payload: bytes, signature: str) -> dict:
        """Handle Stripe webhook events with idempotency and proper error handling."""
        # Verify signature
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

        event_id = event["id"]
        event_type = event["type"]
        data = event["data"]["object"]

        # Idempotency check - skip if already processed
        if self._is_event_processed(event_id):
            logger.info(f"Skipping already processed webhook: {event_id}")
            return {"received": True, "status": "already_processed"}

        logger.info(f"Processing Stripe webhook: {event_type} (ID: {event_id})")

        try:
            # Checkout events
            if event_type == "checkout.session.completed":
                await self._handle_checkout_completed(data)

            # Invoice events
            elif event_type == "invoice.paid":
                await self._handle_invoice_paid(data)
            elif event_type == "invoice.payment_failed":
                await self._handle_invoice_failed(data)
            elif event_type == "invoice.payment_action_required":
                await self._handle_invoice_action_required(data)

            # Subscription lifecycle events
            elif event_type == "customer.subscription.created":
                await self._handle_subscription_created(data)
            elif event_type == "customer.subscription.updated":
                await self._handle_subscription_updated(data)
            elif event_type == "customer.subscription.deleted":
                await self._handle_subscription_deleted(data)
            elif event_type == "customer.subscription.paused":
                await self._handle_subscription_paused(data)
            elif event_type == "customer.subscription.resumed":
                await self._handle_subscription_resumed(data)

            # Payment events
            elif event_type == "charge.refunded":
                await self._handle_charge_refunded(data)
            elif event_type == "charge.dispute.created":
                await self._handle_dispute_created(data)

            # Customer events
            elif event_type == "customer.updated":
                await self._handle_customer_updated(data)

            else:
                logger.debug(f"Unhandled webhook event type: {event_type}")
                self._record_event(event_id, event_type, event_status="skipped")
                return {"received": True}

            # Record successful processing
            self._record_event(event_id, event_type, event_status="processed")

        except TransientError as e:
            # Transient error - tell Stripe to retry
            logger.error(f"Transient error processing webhook {event_type}: {e}")
            self._record_event(event_id, event_type, event_status="failed", error_message=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Temporary error, please retry",
            )

        except PermanentError as e:
            # Permanent error - log but acknowledge to Stripe (no retry needed)
            logger.error(f"Permanent error processing webhook {event_type}: {e}")
            self._record_event(event_id, event_type, event_status="failed", error_message=str(e))
            # Return success to prevent retries, but error is logged for investigation

        except Exception as e:
            # Unknown error - treat as transient to be safe (Stripe will retry)
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"Unknown error processing webhook {event_type}: {e}\nTraceback:\n{error_details}")
            self._record_event(event_id, event_type, event_status="failed", error_message=f"{str(e)}\n{error_details}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal error, please retry",
            )

        return {"received": True}

    async def _handle_credit_purchase(self, session: dict) -> None:
        """Handle checkout.session.completed for credit purchase."""
        user_id = session.get("metadata", {}).get("user_id")
        credits_str = session.get("metadata", {}).get("credits")

        if not user_id or not credits_str:
            logger.warning("checkout.session.completed (payment) missing metadata")
            return

        try:
            credits_amount = int(credits_str)

            # Grant credits
            self.supabase.rpc(
                "grant_credits_to_user",
                {
                    "p_user_id": user_id,
                    "p_amount": credits_amount,
                    "p_reason": "credit_purchase",
                    "p_credit_type": "purchased",
                },
            ).execute()
            logger.info(f"Granted {credits_amount} purchased credits to user {user_id}")
        except Exception as e:
            logger.error(f"Failed to grant purchased credits: {e}")
            raise TransientError(f"Failed to grant credits: {e}")

    async def _handle_checkout_completed(self, session: dict) -> None:
        """Handle checkout.session.completed event."""
        mode = session.get("mode")

        if mode == "payment":
            # Credit purchase
            await self._handle_credit_purchase(session)
            return

        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        user_id = session.get("metadata", {}).get("user_id")

        if not customer_id or not subscription_id:
            logger.warning("checkout.session.completed missing customer or subscription")
            raise PermanentError("Missing customer or subscription in checkout session")

        if not user_id:
            logger.warning("checkout.session.completed missing user_id in metadata")
            raise PermanentError("Missing user_id in checkout session metadata")

        # Get subscription details from Stripe
        try:
            subscription = retrieve_subscription(subscription_id)
        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve subscription: {e}")
            raise TransientError(f"Failed to retrieve subscription from Stripe: {e}")

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

            # Send welcome email
            user_email = await self._get_user_email(user_id)
            if user_email:
                plan_name = await self._get_plan_name(plan_id)
                await send_subscription_welcome(user_email, plan_name)
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            raise TransientError(f"Failed to update subscription in database: {e}")

    async def _handle_invoice_paid(self, invoice: dict) -> None:
        """Handle invoice.paid event - renew subscription."""
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            # Invoice without subscription (one-time payment) - skip
            logger.debug("invoice.paid without subscription_id, skipping")
            return

        try:
            subscription = retrieve_subscription(subscription_id)
        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve subscription for invoice.paid: {e}")
            raise TransientError(f"Failed to retrieve subscription from Stripe: {e}")

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
            raise TransientError(f"Failed to update subscription in database: {e}")

    async def _handle_invoice_failed(self, invoice: dict) -> None:
        """Handle invoice.payment_failed event."""
        subscription_id = invoice.get("subscription")
        if not subscription_id:
            logger.debug("invoice.payment_failed without subscription_id, skipping")
            return

        try:
            result = (
                self.supabase.table("subscriptions")
                .update({"status": "past_due"})
                .eq("stripe_subscription_id", subscription_id)
                .execute()
            )
            logger.warning(f"Subscription payment failed: {subscription_id}")

            # Send payment failed email
            if result.data and len(result.data) > 0:
                user_id = result.data[0].get("user_id")
                if user_id:
                    user_email = await self._get_user_email(user_id)
                    if user_email:
                        invoice_url = invoice.get("hosted_invoice_url")
                        await send_payment_failed(user_email, invoice_url)
        except Exception as e:
            logger.error(f"Failed to update subscription on invoice.failed: {e}")
            raise TransientError(f"Failed to update subscription status: {e}")

    async def _handle_invoice_action_required(self, invoice: dict) -> None:
        """Handle invoice.payment_action_required event (3D Secure, etc)."""
        subscription_id = invoice.get("subscription")
        customer_email = invoice.get("customer_email")
        hosted_invoice_url = invoice.get("hosted_invoice_url")

        if not subscription_id:
            logger.debug("invoice.payment_action_required without subscription_id, skipping")
            return

        try:
            # Update subscription status to incomplete
            self.supabase.table("subscriptions").update({"status": "incomplete"}).eq(
                "stripe_subscription_id", subscription_id
            ).execute()

            logger.warning(
                f"Payment action required for subscription {subscription_id}. "
                f"Customer: {customer_email}, Invoice URL: {hosted_invoice_url}"
            )

            # Send payment action required email
            if customer_email:
                await send_payment_action_required(customer_email, hosted_invoice_url)
        except Exception as e:
            logger.error(f"Failed to handle invoice action required: {e}")
            raise TransientError(f"Failed to update subscription status: {e}")

    async def _handle_subscription_created(self, subscription: dict) -> None:
        """Handle customer.subscription.created event (for subscriptions created outside checkout)."""
        subscription_id = subscription.get("id")
        customer_id = subscription.get("customer")

        if not subscription_id or not customer_id:
            raise PermanentError("subscription.created missing required fields")

        # Try to find user by stripe_customer_id
        try:
            result = (
                self.supabase.table("subscriptions")
                .select("user_id, status")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )

            if not result.data:
                # No existing record - this subscription was created outside our flow
                logger.warning(
                    f"Subscription {subscription_id} created for unknown customer {customer_id}"
                )
                return

            user_id = result.data[0]["user_id"]
            current_status = result.data[0]["status"]

            # If user already has an active subscription, this might be a race condition with checkout.session.completed
            # We only want to process this if the subscription is NOT already active/trialing from checkout
            if current_status in ["active", "trialing"] and subscription["status"] == "active":
                logger.info(
                    f"Skipping subscription.created for user {user_id} (already active from checkout)"
                )
                return

            plan_id = self._get_plan_id_from_price(subscription["items"]["data"][0]["price"]["id"])

            self.supabase.table("subscriptions").update(
                {
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
                }
            ).eq("stripe_customer_id", customer_id).execute()

            # Grant credits ONLY if it wasn't processed by checkout (though checkout handles initial grant)
            # Strategy: Let checkout handle initial grant.
            # If this event comes later or standalone, we grant ONLY if status changed to active and wasn't before.
            # But safer approach: rely on checkout.session.completed for initial purchase credits.
            # Rely on invoice.paid for renewals.
            # So here we SKIP granting credits to avoid duplication.

            logger.info(f"Subscription created/synced for user {user_id}: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to handle subscription created: {e}")
            raise TransientError(f"Failed to process subscription creation: {e}")

    async def _handle_subscription_updated(self, subscription: dict) -> None:
        """Handle customer.subscription.updated event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            raise PermanentError("subscription.updated missing subscription id")

        # Check for plan change (upgrade/downgrade)
        # previous_attributes contains fields that changed
        previous_attributes = subscription.get("previous_attributes", {})
        price_changed = False

        # Check if items changed (which implies price/plan change)
        if "items" in previous_attributes:
            price_changed = True
        # Or if the price ID in the first item is different from what we might have expected?
        # Simpler: check if the new price ID maps to a different plan than what we have stored

        new_price_id = subscription["items"]["data"][0]["price"]["id"]
        new_plan_id = self._get_plan_id_from_price(new_price_id)

        try:
            # Get current stored plan
            current_sub = (
                self.supabase.table("subscriptions")
                .select("plan_id, user_id")
                .eq("stripe_subscription_id", subscription_id)
                .single()
                .execute()
            )

            user_id = None
            old_plan_id = None

            if current_sub.data:
                user_id = current_sub.data.get("user_id")
                old_plan_id = current_sub.data.get("plan_id")

            # Update subscription
            self.supabase.table("subscriptions").update(
                {
                    "plan_id": new_plan_id,
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

            logger.info(f"Subscription updated: {subscription_id}, plan: {new_plan_id}")

            # Handle Proration / Plan Change Credits
            # If plan changed AND subscription is active
            if (
                user_id
                and old_plan_id
                and new_plan_id != old_plan_id
                and subscription["status"] == "active"
            ):
                logger.info(
                    f"Plan changed from {old_plan_id} to {new_plan_id} for user {user_id}. Resetting credits to new plan limit."
                )
                # Reset monthly credits to the new plan's limit immediately.
                # User gets the new plan's credits (whether upgrade or downgrade).
                await self._reset_monthly_credits(user_id, new_plan_id)

        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            raise TransientError(f"Failed to update subscription in database: {e}")

    async def _handle_subscription_deleted(self, subscription: dict) -> None:
        """Handle customer.subscription.deleted event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            raise PermanentError("subscription.deleted missing subscription id")

        try:
            # 1. Update subscription status
            result = (
                self.supabase.table("subscriptions")
                .update(
                    {
                        "status": "canceled",
                        "plan_id": "free",
                        "stripe_subscription_id": None,
                    }
                )
                .eq("stripe_subscription_id", subscription_id)
                .execute()
            )

            # 2. Reset monthly credits to 0 immediately
            # Since the subscription is gone, the user loses access to the plan's credits.
            if result.data and len(result.data) > 0:
                user_id = result.data[0].get("user_id")
                if user_id:
                    # Reset monthly credits to 0 (Free plan default or just zeroed out)
                    # Assuming 'free' plan has 0 monthly credits or small amount.
                    # Better: explicitly call reset with 0 or the free plan limit.

                    # Check free plan limit
                    free_plan_res = (
                        self.supabase.table("billing_plans")
                        .select("monthly_credits")
                        .eq("slug", "free")
                        .single()
                        .execute()
                    )
                    free_credits = (
                        free_plan_res.data.get("monthly_credits", 0) if free_plan_res.data else 0
                    )

                    await self.supabase.rpc(
                        "reset_monthly_credits",
                        {"p_user_id": user_id, "p_new_amount": free_credits},
                    ).execute()
                    logger.info(
                        f"Subscription canceled: {subscription_id}. Credits reset to free tier ({free_credits})."
                    )

            # Send subscription canceled email
            if result.data and len(result.data) > 0:
                user_id = result.data[0].get("user_id")
                if user_id:
                    user_email = await self._get_user_email(user_id)
                    if user_email:
                        await send_subscription_canceled(user_email)
        except Exception as e:
            logger.error(f"Failed to update subscription on delete: {e}")
            raise TransientError(f"Failed to update subscription on cancellation: {e}")

    async def _handle_subscription_paused(self, subscription: dict) -> None:
        """Handle customer.subscription.paused event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            raise PermanentError("subscription.paused missing subscription id")

        try:
            self.supabase.table("subscriptions").update({"status": "paused"}).eq(
                "stripe_subscription_id", subscription_id
            ).execute()
            logger.info(f"Subscription paused: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription on pause: {e}")
            raise TransientError(f"Failed to pause subscription: {e}")

    async def _handle_subscription_resumed(self, subscription: dict) -> None:
        """Handle customer.subscription.resumed event."""
        subscription_id = subscription.get("id")
        if not subscription_id:
            raise PermanentError("subscription.resumed missing subscription id")

        try:
            result = (
                self.supabase.table("subscriptions")
                .update({"status": "active"})
                .eq("stripe_subscription_id", subscription_id)
                .execute()
            )

            # Grant credits when subscription is resumed
            if result.data and len(result.data) > 0:
                user_id = result.data[0].get("user_id")
                plan_id = result.data[0].get("plan_id")
                if user_id and plan_id:
                    await self._grant_plan_credits(user_id, plan_id)

            logger.info(f"Subscription resumed: {subscription_id}")
        except Exception as e:
            logger.error(f"Failed to update subscription on resume: {e}")
            raise TransientError(f"Failed to resume subscription: {e}")

    async def _handle_charge_refunded(self, charge: dict) -> None:
        """Handle charge.refunded event - revoke credits if applicable."""
        invoice_id = charge.get("invoice")
        amount_refunded = charge.get("amount_refunded", 0)
        refunded = charge.get("refunded", False)

        if not invoice_id:
            logger.debug("charge.refunded without invoice_id, skipping")
            return

        try:
            # Get invoice to find subscription
            invoice = retrieve_invoice(invoice_id)
            subscription_id = invoice.get("subscription")

            if not subscription_id:
                logger.debug("Refunded charge not associated with subscription")
                return

            # Find user by subscription
            result = (
                self.supabase.table("subscriptions")
                .select("user_id, plan_id")
                .eq("stripe_subscription_id", subscription_id)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                user_id = result.data[0]["user_id"]

                # If fully refunded, revoke credits
                if refunded:
                    logger.warning(
                        f"Full refund for subscription {subscription_id}, "
                        f"user {user_id}. Consider revoking credits."
                    )
                    # TODO: Implement credit revocation if needed
                else:
                    logger.info(
                        f"Partial refund ({amount_refunded}) for subscription {subscription_id}"
                    )

        except stripe.StripeError as e:
            logger.error(f"Failed to retrieve invoice for refund: {e}")
            raise TransientError(f"Failed to process refund: {e}")
        except Exception as e:
            logger.error(f"Failed to handle charge refunded: {e}")
            raise TransientError(f"Failed to process refund: {e}")

    async def _handle_dispute_created(self, dispute: dict) -> None:
        """Handle charge.dispute.created event - critical alert."""
        charge_id = dispute.get("charge")
        amount = dispute.get("amount", 0)
        reason = dispute.get("reason", "unknown")
        status = dispute.get("status", "unknown")

        logger.critical(
            f"DISPUTE CREATED - Charge: {charge_id}, Amount: {amount}, "
            f"Reason: {reason}, Status: {status}"
        )

        # Try to find associated subscription
        try:
            if charge_id:
                charge = retrieve_charge(charge_id)
                invoice_id = charge.get("invoice")

                if invoice_id:
                    invoice = retrieve_invoice(invoice_id)
                    subscription_id = invoice.get("subscription")

                    if subscription_id:
                        result = (
                            self.supabase.table("subscriptions")
                            .select("user_id")
                            .eq("stripe_subscription_id", subscription_id)
                            .limit(1)
                            .execute()
                        )

                        if result.data:
                            user_id = result.data[0]["user_id"]
                            logger.critical(f"Dispute for user {user_id}")

                            # Send urgent notification to admin
                            await send_dispute_alert(
                                user_id=user_id,
                                charge_id=charge_id,
                                amount=amount,
                                reason=reason,
                            )

        except Exception as e:
            logger.error(f"Failed to get dispute details: {e}")
            # Don't raise - dispute is logged, we don't want to retry

    async def _handle_customer_updated(self, customer: dict) -> None:
        """Handle customer.updated event - sync customer data."""
        customer_id = customer.get("id")
        email = customer.get("email")
        name = customer.get("name")

        if not customer_id:
            raise PermanentError("customer.updated missing customer id")

        try:
            # Find subscription by customer_id
            result = (
                self.supabase.table("subscriptions")
                .select("user_id")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )

            if result.data and len(result.data) > 0:
                user_id = result.data[0]["user_id"]

                # Update profile with new email/name if provided
                update_data = {}
                if email:
                    update_data["email"] = email
                if name:
                    update_data["name"] = name

                if update_data:
                    self.supabase.table("profiles").update(update_data).eq("id", user_id).execute()
                    logger.info(f"Updated profile for user {user_id} from Stripe customer data")

        except Exception as e:
            logger.error(f"Failed to sync customer data: {e}")
            # Don't raise - this is non-critical

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
        """Map Stripe price_id to internal plan_id using database lookup."""
        result = (
            self.supabase.table("billing_plans")
            .select("slug")
            .eq("stripe_price_id", price_id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return result.data[0]["slug"]

        logger.warning(f"Unknown price_id: {price_id}, defaulting to free")
        return "free"

    async def _get_user_email(self, user_id: str) -> str | None:
        """Get user email from profiles table."""
        try:
            result = (
                self.supabase.table("profiles").select("email").eq("id", user_id).limit(1).execute()
            )
            if result.data and len(result.data) > 0:
                return result.data[0].get("email")
        except Exception as e:
            logger.error(f"Failed to get user email: {e}")
        return None

    async def _get_plan_name(self, plan_id: str) -> str:
        """Get plan display name from billing_plans table."""
        try:
            result = (
                self.supabase.table("billing_plans")
                .select("name")
                .eq("slug", plan_id)
                .limit(1)
                .execute()
            )
            if result.data and len(result.data) > 0:
                return result.data[0].get("name", plan_id)
        except Exception as e:
            logger.error(f"Failed to get plan name: {e}")
        return plan_id


webhooks_service = WebhooksService()
