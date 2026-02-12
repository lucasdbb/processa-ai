import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ClientCreate {
  name: string;
  email?: string;
  phone?: string;
  cpf_cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export interface ClientUpdate extends Partial<ClientCreate> {
  status?: "active" | "inactive" | "archived";
}

export interface ClientListParams {
  search?: string;
  status?: "active" | "inactive" | "archived";
  limit?: number;
  offset?: number;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
}

export interface ClientProcessSummary {
  id: string;
  number: string;
  type: string;
  status: string;
  court: string | null;
  value: number | null;
  next_deadline: string | null;
}

export interface ClientFeeSummary {
  total_amount: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  fees_count: number;
}

export interface ClientNoteSummary {
  id: string;
  title: string;
  note_type: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientServiceSummary {
  total_amount: number;
  total_paid: number;
  total_pending: number;
  services_count: number;
  active_count: number;
  completed_count: number;
}

export interface ClientDetail extends Client {
  processes: ClientProcessSummary[];
  processes_count: number;
  fees_summary: ClientFeeSummary;
  services_summary: ClientServiceSummary;
  services_count: number;
  recent_notes: ClientNoteSummary[];
  notes_count: number;
}

export const clientsService = {
  async list(params?: ClientListParams): Promise<ClientListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const url = `${API_URL}/office/clients${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetchWithCredentials(url);
    if (!res.ok) throw new Error("Failed to fetch clients");
    return res.json();
  },

  async count(): Promise<{ total: number }> {
    const response = await fetchWithCredentials(`${API_URL}/office/clients/count`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to count clients");
    }

    return response.json();
  },

  async get(id: string): Promise<Client> {
    const res = await fetchWithCredentials(`${API_URL}/office/clients/${id}`);
    if (!res.ok) throw new Error("Failed to fetch client");
    return res.json();
  },

  async getDetail(id: string): Promise<ClientDetail> {
    const res = await fetchWithCredentials(`${API_URL}/office/clients/${id}/detail`);
    if (!res.ok) throw new Error("Failed to fetch client detail");
    return res.json();
  },

  async create(data: ClientCreate): Promise<Client> {
    const res = await fetchWithCredentials(`${API_URL}/office/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create client");
    return res.json();
  },

  async update(id: string, data: ClientUpdate): Promise<Client> {
    const res = await fetchWithCredentials(`${API_URL}/office/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update client");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(`${API_URL}/office/clients/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete client");
  },
};
