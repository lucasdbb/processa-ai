import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type ClientRole = "author" | "defendant";
export type ProcessCategory = "judicial" | "administrative";

export interface Process {
  next_deadline: any;
  id: string;
  user_id: string;
  client_id: string;
  client_name?: string;
  process_number: string;
  process_category: ProcessCategory;
  court: string | null;
  tribunal: string | null;
  defendant: string | null;
  client_role: ClientRole;
  type: string;
  area: string | null;
  subject: string | null;
  value: number | null;
  status: "active" | "concluded" | "cancelled";
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  is_partnership: boolean;
  partner_lawyer: string | null;
  partner_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessCreate {
  client_id: string;
  process_number: string;
  process_category?: ProcessCategory;
  court?: string;
  tribunal?: string;
  defendant?: string;
  client_role?: ClientRole;
  type: string;
  area?: string;
  subject?: string;
  value?: number | null;
  notes?: string;
  start_date?: string;
  is_partnership?: boolean;
  partner_lawyer?: string;
  partner_percentage?: number;
}

export interface ProcessUpdate extends Partial<
  Omit<ProcessCreate, "client_id">
> {
  status?: "active" | "concluded" | "cancelled";
  end_date?: string;
}

export interface ProcessListParams {
  search?: string;
  status?: "active" | "concluded" | "cancelled" | "all";
  client_id?: string;
  tribunal?: string;
  process_category?: string;
  is_partnership?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProcessListResponse {
  processes: Process[];
  total: number;
}

export interface ProcessClientInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf_cnpj: string | null;
}

export interface ProcessDeadlineSummary {
  id: string;
  title: string;
  due_date: string;
  status: string;
  priority: string | null;
  days_until: number;
}

export interface ProcessTimelineEvent {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_date: string;
  documents?: Array<{
    id: string;
    name: string;
    file_url: string;
  }>;
  created_at: string;
}

export interface ProcessDocumentSummary {
  id: string;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  file_url: string | null;
  visible_to_client: boolean;
  created_at: string;
}

export interface ProcessDetail extends Process {
  client: ProcessClientInfo;
  deadlines: ProcessDeadlineSummary[];
  deadlines_count: number;
  overdue_deadlines_count: number;
  timeline: ProcessTimelineEvent[];
  timeline_count: number;
  documents: ProcessDocumentSummary[];
  documents_count: number;
}

export const processesService = {
  async list(params?: ProcessListParams): Promise<ProcessListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status && params.status !== "all") searchParams.set("status", params.status);
    if (params?.client_id) searchParams.set("client_id", params.client_id);
    if (params?.tribunal && params.tribunal !== "all") searchParams.set("tribunal", params.tribunal);
    if (params?.process_category && params.process_category !== "all") searchParams.set("process_category", params.process_category);
    if (params?.is_partnership !== undefined) searchParams.set("is_partnership", params.is_partnership.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const url = `${API_URL}/office/processes${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetchWithCredentials(url);
    if (!res.ok) throw new Error("Failed to fetch processes");
    return res.json();
  },

  async count(): Promise<{ total: number }> {
    const response = await fetchWithCredentials(`${API_URL}/office/processes/count`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to count processes");
    }

    return response.json();
  },

  async get(id: string): Promise<Process> {
    const res = await fetchWithCredentials(`${API_URL}/office/processes/${id}`);
    if (!res.ok) throw new Error("Failed to fetch process");
    return res.json();
  },

  async getDetail(id: string): Promise<ProcessDetail> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/processes/${id}/detail`,
    );
    if (!res.ok) throw new Error("Failed to fetch process detail");
    return res.json();
  },

  async create(data: ProcessCreate): Promise<Process> {
    const res = await fetchWithCredentials(`${API_URL}/office/processes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create process");
    return res.json();
  },

  async update(id: string, data: ProcessUpdate): Promise<Process> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/processes/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Failed to update process");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/processes/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) throw new Error("Failed to delete process");
  },
};
