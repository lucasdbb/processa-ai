import stripe

from src.core.config import settings

# Initialize Stripe with API key
stripe.api_key = settings.STRIPE_SECRET_KEY

# Export stripe module for use in services
__all__ = ["stripe"]
