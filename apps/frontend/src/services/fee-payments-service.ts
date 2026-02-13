import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface FeePayment {
  id: string;
  user_id: string;
  fee_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeePaymentCreate {
  fee_id: string;
  amount: number;
  payment_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export interface FeePaymentUpdate {
  amount?: number;
  payment_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export interface FeePaymentListResponse {
  payments: FeePayment[];
  total: number;
}

export const feePaymentsService = {
  async listByFee(feeId: string): Promise<FeePaymentListResponse> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fee-payments/fee/${feeId}/payments`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch payments");
    }

    return response.json();
  },

  async get(paymentId: string): Promise<FeePayment> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fee-payments/${paymentId}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch payment");
    }

    return response.json();
  },

  async create(data: FeePaymentCreate): Promise<FeePayment> {
    const response = await fetchWithCredentials(`${API_URL}/office/fee-payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to create payment");
    }

    return response.json();
  },

  async update(paymentId: string, data: FeePaymentUpdate): Promise<FeePayment> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fee-payments/${paymentId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to update payment");
    }

    return response.json();
  },

  async delete(paymentId: string): Promise<void> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fee-payments/${paymentId}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to delete payment");
    }
  },
};
