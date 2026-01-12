from pydantic import BaseModel


class BillingPlanPrice(BaseModel):
    currency: str
    amount_cents: int
    interval: str


class BillingPlanPublic(BaseModel):
    slug: str
    name: str
    description: str | None = None
    is_popular: bool
    is_sellable: bool
    sort_order: int
    price: BillingPlanPrice | None = None
    features: list[str]
