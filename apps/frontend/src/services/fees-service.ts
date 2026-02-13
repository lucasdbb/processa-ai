import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type FeeType =
  | "initial" // Honorários iniciais/entrada
  | "success" // Honorários de êxito
  | "monthly" // Mensalidade
  | "hourly" // Por hora
  | "hearing" // Por audiência
  | "petition" // Por petição
  | "other"; // Outros

export type FeeStatus =
  | "pending" // Aguardando pagamento
  | "paid" // Pago
  | "overdue" // Em atraso
  | "cancelled"; // Cancelado

export interface Fee {
  id: string;
  user_id: string;
  client_id: string;
  process_id: string | null;
  service_id: string | null;
  fee_type: FeeType;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: FeeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeeCreate {
  client_id: string;
  process_id?: string | null;
  service_id?: string | null;
  fee_type: FeeType;
  description: string;
  amount: number;
  due_date?: string | null;
  notes?: string | null;
}

export interface FeeUpdate {
  process_id?: string | null;
  service_id?: string | null;
  fee_type?: FeeType;
  description?: string;
  amount?: number;
  due_date?: string | null;
  paid_at?: string | null;
  status?: FeeStatus;
  notes?: string | null;
}

export interface FeeSummary {
  total_amount: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  fees_count: number;
}

export interface FeesListResponse {
  fees: Fee[];
  total: number;
}

export const feesService = {
  async list(clientId?: string, processId?: string, serviceId?: string): Promise<FeesListResponse> {
    const params = new URLSearchParams();
    if (clientId) params.append("client_id", clientId);
    if (processId) params.append("process_id", processId);
    if (serviceId) params.append("service_id", serviceId);

    const url = `${API_URL}/office/fees${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetchWithCredentials(url, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch fees");
    }

    return response.json();
  },

  async get(id: string): Promise<Fee> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fees/${id}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch fee");
    }

    return response.json();
  },

  async create(data: FeeCreate): Promise<Fee> {
    const response = await fetchWithCredentials(`${API_URL}/office/fees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to create fee");
    }

    return response.json();
  },

  async update(id: string, data: FeeUpdate): Promise<Fee> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fees/${id}`,
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
      throw new Error(error.detail || "Failed to update fee");
    }

    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fees/${id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to delete fee");
    }
  },

  async getSummary(clientId: string): Promise<FeeSummary> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/fees/summary/${clientId}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch fee summary");
    }

    return response.json();
  },
};
