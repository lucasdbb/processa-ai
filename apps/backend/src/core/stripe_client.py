import stripe

from src.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY
