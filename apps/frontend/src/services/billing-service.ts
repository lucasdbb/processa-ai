import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface CreateCheckoutData {
  price_id: string
  success_url?: string
  cancel_url?: string
}

export interface CheckoutResponse {
  checkout_url: string
  session_id: string
}

export interface PortalResponse {
  portal_url: string
}

export interface SubscriptionStatus {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan_id: string
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | 'none'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export interface InvoiceItem {
  id: string
  amount: number
  currency: string
  status: string
  created: string
  invoice_url: string | null
  invoice_pdf: string | null
}

export interface InvoiceListResponse {
  invoices: InvoiceItem[]
  has_more: boolean
}

export const billingService = {
  async createCheckout(data: CreateCheckoutData): Promise<CheckoutResponse> {
    const res = await fetchWithCredentials(`${API_URL}/billing/subscriptions/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to create checkout session')
    return res.json()
  },

  async getPortalUrl(): Promise<PortalResponse> {
    const res = await fetchWithCredentials(`${API_URL}/billing/subscriptions/portal`)
    if (!res.ok) throw new Error('Failed to get portal URL')
    return res.json()
  },

  async getSubscription(): Promise<SubscriptionStatus> {
    const res = await fetchWithCredentials(`${API_URL}/billing/subscriptions/subscription`)
    if (!res.ok) throw new Error('Failed to get subscription')
    return res.json()
  },

  async listInvoices(limit = 10): Promise<InvoiceListResponse> {
    const res = await fetchWithCredentials(`${API_URL}/billing/subscriptions/invoices?limit=${limit}`)
    if (!res.ok) throw new Error('Failed to list invoices')
    return res.json()
  },
}
