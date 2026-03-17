import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type ServiceCategory =
  | "previdenciario"
  | "trabalhista"
  | "civel"
  | "tributario"
  | "familiar"
  | "empresarial"
  | "imobiliario"
  | "administrativo"
  | "consultoria"
  | "outro";

export type ServiceStatus = "active" | "completed" | "cancelled";

export interface Service {
  id: string;
  user_id: string;
  client_id: string;
  client_name?: string;
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  value: number | null;
  paid_amount: number;
  notes: string | null;
  is_partnership: boolean;
  partner_lawyer: string | null;
  partner_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCreate {
  client_id: string;
  name: string;
  category: ServiceCategory;
  value?: number | null;
  notes?: string | null;
  is_partnership?: boolean;
  partner_lawyer?: string | null;
  partner_percentage?: number | null;
}

export interface ServiceUpdate {
  name?: string;
  category?: ServiceCategory;
  status?: ServiceStatus;
  value?: number | null;
  notes?: string | null;
  is_partnership?: boolean;
  partner_lawyer?: string | null;
  partner_percentage?: number | null;
}

export interface ServiceSummary {
  total_amount: number;
  total_paid: number;
  total_pending: number;
  services_count: number;
  active_count: number;
  completed_count: number;
}

export interface ServiceClientInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
}

export interface ServiceDocumentSummary {
  id: string;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  file_url: string | null;
  created_at: string;
}

export interface ServiceDetail extends Service {
  client: ServiceClientInfo;
  documents: ServiceDocumentSummary[];
  documents_count: number;
}

export interface ServicesListResponse {
  services: Service[];
  total: number;
}

export interface ServicesListParams {
  clientId?: string;
  category?: ServiceCategory | "all";
  status?: ServiceStatus | "all";
  search?: string;
  isPartnership?: boolean;
}

export const servicesService = {
  async list(
    params?: ServicesListParams
  ): Promise<ServicesListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.clientId) searchParams.append("client_id", params.clientId);
    if (params?.category && params.category !== "all") searchParams.append("category", params.category);
    if (params?.status && params.status !== "all") searchParams.append("status", params.status);
    if (params?.search) searchParams.append("search", params.search);
    if (params?.isPartnership !== undefined) searchParams.append("is_partnership", params.isPartnership.toString());

    const url = `${API_URL}/office/services${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const response = await fetchWithCredentials(url, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch services");
    }

    return response.json();
  },

  async count(): Promise<{ total: number }> {
    const response = await fetchWithCredentials(`${API_URL}/office/services/count`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to count services");
    }

    return response.json();
  },

  async get(id: string): Promise<Service> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/${id}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch service");
    }

    return response.json();
  },

  async getDetail(id: string): Promise<ServiceDetail> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/${id}/detail`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch service detail");
    }

    return response.json();
  },

  async create(data: ServiceCreate): Promise<Service> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to create service");
    }

    return response.json();
  },

  async update(id: string, data: ServiceUpdate): Promise<Service> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/${id}`,
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
      throw new Error(error.detail || "Failed to update service");
    }

    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/${id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to delete service");
    }
  },

  async getSummary(clientId: string): Promise<ServiceSummary> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/summary/${clientId}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch service summary");
    }

    return response.json();
  },

  async pay(id: string, amount: number): Promise<Service> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/services/${id}/pay`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to register payment");
    }

    return response.json();
  },
};
