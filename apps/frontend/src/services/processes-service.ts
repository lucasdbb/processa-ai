import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface Process {
  id: string;
  user_id: string;
  client_id: string;
  process_number: string;
  court: string | null;
  defendant: string | null;
  type: string;
  subject: string | null;
  value: number | null;
  status:
    | "active"
    | "pending"
    | "suspended"
    | "archived"
    | "concluded"
    | "cancelled";
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessCreate {
  client_id: string;
  process_number: string;
  court?: string;
  defendant?: string;
  type: string;
  subject?: string;
  value?: number | null;
  notes?: string;
  start_date?: string;
}

export interface ProcessUpdate extends Partial<
  Omit<ProcessCreate, "client_id">
> {
  status?:
    | "active"
    | "pending"
    | "suspended"
    | "archived"
    | "concluded"
    | "cancelled";
  end_date?: string;
}

export interface ProcessListParams {
  search?: string;
  status?:
    | "active"
    | "pending"
    | "suspended"
    | "archived"
    | "concluded"
    | "cancelled";
  client_id?: string;
  limit?: number;
  offset?: number;
}

export interface ProcessListResponse {
  processes: Process[];
  total: number;
}

export const processesService = {
  async list(params?: ProcessListParams): Promise<ProcessListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.client_id) searchParams.set("client_id", params.client_id);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const url = `${API_URL}/office/processes${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetchWithCredentials(url);
    if (!res.ok) throw new Error("Failed to fetch processes");
    return res.json();
  },

  async get(id: string): Promise<Process> {
    const res = await fetchWithCredentials(`${API_URL}/office/processes/${id}`);
    if (!res.ok) throw new Error("Failed to fetch process");
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
