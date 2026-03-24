import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface CreateCheckoutData {
  price_id: string;
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface PortalResponse {
  portal_url: string;
}

export interface SubscriptionStatus {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string;
  status:
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "trialing"
    | "paused"
    | "none";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface InvoiceItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  invoice_url: string | null;
  invoice_pdf: string | null;
}

export interface InvoiceListResponse {
  invoices: InvoiceItem[];
  has_more: boolean;
}

export const billingService = {
  async createCheckout(data: CreateCheckoutData): Promise<CheckoutResponse> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/checkout`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.detail || "Failed to create checkout session");
    }
    return res.json();
  },

  async getPortalUrl(): Promise<PortalResponse> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/portal`,
    );
    if (!res.ok) throw new Error("Failed to get portal URL");
    return res.json();
  },

  async getSubscription(): Promise<SubscriptionStatus> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/subscription`,
    );
    if (!res.ok) throw new Error("Failed to get subscription");
    return res.json();
  },

  async listInvoices(limit = 10): Promise<InvoiceListResponse> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/invoices?limit=${limit}`,
    );
    if (!res.ok) throw new Error("Failed to list invoices");
    return res.json();
  },

  async changePlan(price_id: string): Promise<{ success: boolean }> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/change-plan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { detail?: string }).detail || "Failed to change plan",
      );
    }
    return res.json();
  },

  async cancelSubscription(): Promise<{ success: boolean }> {
    const res = await fetchWithCredentials(
      `${API_URL}/billing/subscriptions/cancel`,
      {
        method: "POST",
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { detail?: string }).detail || "Failed to cancel subscription",
      );
    }
    return res.json();
  },
};
