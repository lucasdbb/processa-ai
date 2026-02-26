"""
Stripe client configuration with retry logic and timeout.
"""

import stripe
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.core.config import settings
from src.core.logging import logger

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY
stripe.max_network_retries = 2  # Built-in retry for network errors

# Configure timeout (in seconds)
STRIPE_TIMEOUT = 30


def _is_retryable_error(exception: Exception) -> bool:
    """Check if the Stripe error is retryable."""
    if isinstance(exception, stripe.APIConnectionError):
        return True
    if isinstance(exception, stripe.RateLimitError):
        return True
    if isinstance(exception, stripe.APIError):
        # 5xx errors are retryable
        if hasattr(exception, "http_status") and exception.http_status >= 500:
            return True
    return False


# Retry decorator for Stripe API calls
stripe_retry = retry(
    retry=retry_if_exception_type((stripe.APIConnectionError, stripe.RateLimitError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    before_sleep=lambda retry_state: logger.warning(
        f"Stripe API call failed, retrying in {retry_state.next_action.sleep} seconds... "
        f"(attempt {retry_state.attempt_number}/3)"
    ),
)


@stripe_retry
def retrieve_subscription(subscription_id: str) -> stripe.Subscription:
    """Retrieve a Stripe subscription with retry."""
    return stripe.Subscription.retrieve(
        subscription_id,
    )


@stripe_retry
def retrieve_customer(customer_id: str) -> stripe.Customer:
    """Retrieve a Stripe customer with retry."""
    return stripe.Customer.retrieve(
        customer_id,
    )


@stripe_retry
def create_customer(
    email: str, name: str | None = None, metadata: dict | None = None
) -> stripe.Customer:
    """Create a Stripe customer with retry."""
    return stripe.Customer.create(
        email=email,
        name=name,
        metadata=metadata or {},
    )


@stripe_retry
def create_checkout_session(
    customer: str,
    price_id: str | None = None,
    success_url: str = "",
    cancel_url: str = "",
    metadata: dict | None = None,
    mode: str = "subscription",
    line_items: list[dict] | None = None,
) -> stripe.checkout.Session:
    """Create a Stripe checkout session with retry."""
    if line_items is None and price_id:
        line_items = [{"price": price_id, "quantity": 1}]

    return stripe.checkout.Session.create(
        customer=customer,
        line_items=line_items,
        mode=mode,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata or {},
    )


@stripe_retry
def create_portal_session(customer: str, return_url: str) -> stripe.billing_portal.Session:
    """Create a Stripe billing portal session with retry."""
    return stripe.billing_portal.Session.create(
        customer=customer,
        return_url=return_url,
    )


@stripe_retry
def list_invoices(customer: str, limit: int = 10) -> stripe.ListObject:
    """List Stripe invoices for a customer with retry."""
    return stripe.Invoice.list(
        customer=customer,
        limit=limit,
    )


@stripe_retry
def retrieve_invoice(invoice_id: str) -> stripe.Invoice:
    """Retrieve a Stripe invoice with retry."""
    return stripe.Invoice.retrieve(
        invoice_id,
    )


@stripe_retry
def retrieve_charge(charge_id: str) -> stripe.Charge:
    """Retrieve a Stripe charge with retry."""
    return stripe.Charge.retrieve(
        charge_id,
    )


@stripe_retry
def modify_subscription(subscription_id: str, price_id: str) -> stripe.Subscription:
    """Change a subscription's plan immediately with proration."""
    sub = stripe.Subscription.retrieve(subscription_id)
    item_id = sub["items"].data[0].id
    return stripe.Subscription.modify(
        subscription_id,
        items=[{"id": item_id, "price": price_id}],
        proration_behavior="create_prorations",
    )


@stripe_retry
def cancel_subscription_at_period_end(subscription_id: str) -> stripe.Subscription:
    """Cancel a subscription at the end of the current billing period."""
    return stripe.Subscription.modify(
        subscription_id,
        cancel_at_period_end=True,
    )


def get_subscription_period(subscription) -> dict:
    """Extract billing period from subscription's first item.

    Since Stripe API 2025-03-31.basil (SDK v12+), current_period_start/end
    were removed from the Subscription object and moved to each
    SubscriptionItem. This helper reads from the first item.

    NOTE: We use subscription["items"] (dict-style) instead of subscription.items
    because in stripe-python v14, Subscription inherits from dict, and .items
    collides with the builtin dict.items() method.
    """
    item = subscription["items"].data[0]
    return {
        "current_period_start": item.current_period_start,
        "current_period_end": item.current_period_end,
    }


def get_first_item(subscription):
    """Get the first SubscriptionItem from a Stripe Subscription object.

    Uses dict-style access for 'items' to avoid collision with dict.items().
    """
    return subscription["items"].data[0]
