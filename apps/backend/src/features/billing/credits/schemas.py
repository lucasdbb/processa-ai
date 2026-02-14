from typing import Optional, List
from pydantic import BaseModel

class CreditCheckResponse(BaseModel):
    has_credits: bool
    cost: int
    available: int

class ConsumeCreditsResponse(BaseModel):
    success: bool
    credits_consumed: int
    remaining: int

class FeatureCostItem(BaseModel):
    feature_key: str
    display_name: str
    cost: int
    description: Optional[str] = None

class CreditPackage(BaseModel):
    id: str
    name: str
    credits: int
    price_cents: int

class PurchaseCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str

class PurchaseCreditsRequest(BaseModel):
    package_id: str
    redirect_url: str

class CreditTransaction(BaseModel):
    id: str
    amount: int
    transaction_type: str   # grant, consume, refund, reset
    credit_type: str        # subscription, purchased
    reason: Optional[str] = None
    created_at: str

class CreditHistoryResponse(BaseModel):
    transactions: List[CreditTransaction]
    total: int
    page: int
    page_size: int

class ClaimWelcomeRequest(BaseModel):
    cpf: str
