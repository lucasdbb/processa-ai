import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface UserCredits {
  user_id: string
  subscription_credits: number
  purchased_credits: number
  total_available: number
  last_reset_at: string | null
}

export interface CreditCheckResponse {
  has_credits: boolean
  cost: number
  available: number
}

export interface ConsumeCreditsResponse {
  success: boolean
  credits_consumed: number
  remaining: number
}

export interface FeatureCostItem {
  feature_key: string
  display_name: string
  cost: number
  description?: string
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price_cents: number
}

export interface PurchaseCheckoutResponse {
  checkout_url: string
  session_id: string
}

export interface CreditTransaction {
  id: string
  amount: number
  transaction_type: 'grant' | 'consume' | 'refund' | 'reset'
  credit_type: 'subscription' | 'purchased'
  reason?: string
  created_at: string
}

export interface CreditHistoryResponse {
  transactions: CreditTransaction[]
  total: number
  page: number
  page_size: number
}

export interface AdminUsageByFeature {
  feature_key: string
  total_consumed: number
  count: number
}

export interface AdminTopConsumer {
  user_id: string
  name: string | null
  email: string | null
  total_consumed: number
}

export interface AdminCreditsMetrics {
  total_consumed_all_time: number
  total_consumed_last_30d: number
  total_revenue_cents: number
  usage_by_feature: AdminUsageByFeature[]
  top_consumers: AdminTopConsumer[]
}

export const creditsService = {
  async checkCredits(featureKey: string): Promise<CreditCheckResponse> {
    const res = await fetchWithCredentials(`${API_URL}/credits/check/${featureKey}`)
    if (!res.ok) throw new Error('Failed to check credits')
    return res.json()
  },

  async getFeatureCosts(): Promise<FeatureCostItem[]> {
    const res = await fetchWithCredentials(`${API_URL}/credits/costs`)
    if (!res.ok) throw new Error('Failed to get feature costs')
    return res.json()
  },

  async getPackages(): Promise<CreditPackage[]> {
    const res = await fetchWithCredentials(`${API_URL}/credits/packages`)
    if (!res.ok) throw new Error('Failed to get packages')
    return res.json()
  },

  async purchaseCredits(packageId: string, redirectUrl: string): Promise<PurchaseCheckoutResponse> {
    const res = await fetchWithCredentials(`${API_URL}/credits/purchase`, {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId, redirect_url: redirectUrl }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to initiate purchase')
    return res.json()
  },

  async claimWelcomeCredits(cpf: string): Promise<{ success: boolean; credits_granted: number }> {
    const res = await fetchWithCredentials(`${API_URL}/credits/claim-welcome`, {
      method: 'POST',
      body: JSON.stringify({ cpf }),
      headers: { 'Content-Type': 'application/json' },
    })
    
    if (res.status === 409) throw { status: 409, message: 'CPF já cadastrado' }
    if (res.status === 429) throw { status: 429, message: 'Limite de requisições excedido' }
    if (!res.ok) throw new Error('Failed to claim credits')
    
    return res.json()
  },

  async getHistory(page = 1, pageSize = 20): Promise<CreditHistoryResponse> {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() })
    const res = await fetchWithCredentials(`${API_URL}/credits/history?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to get history')
    return res.json()
  },

  async claimChecklistBonus(): Promise<{ success: boolean; credits_granted: number }> {
    const res = await fetchWithCredentials(`${API_URL}/credits/claim-checklist-bonus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Failed to claim checklist bonus')
    return res.json()
  },

  async getAdminStats(): Promise<AdminCreditsMetrics> {
    const res = await fetchWithCredentials(`${API_URL}/credits/admin/stats`)
    if (!res.ok) throw new Error('Failed to get admin stats')
    return res.json()
  }
}
