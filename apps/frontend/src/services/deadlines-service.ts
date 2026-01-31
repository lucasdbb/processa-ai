import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface Deadline {
  id: string;
  user_id: string;
  process_id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "completed" | "cancelled";
  completed_at: string | null;
  reminder_days_before: number;
  created_at: string;
  updated_at: string;
}

export interface DeadlineCreate {
  process_id: string;
  title: string;
  description?: string;
  due_date: string;
  priority?: "low" | "medium" | "high" | "urgent";
  reminder_days_before?: number | null;
}

export interface DeadlineUpdate extends Partial<
  Omit<DeadlineCreate, "process_id">
> {
  status?: "pending" | "completed" | "cancelled";
}

export interface DeadlineListParams {
  start_date?: string;
  end_date?: string;
  status?: "pending" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  process_id?: string;
  limit?: number;
  offset?: number;
}

export interface DeadlineListResponse {
  deadlines: Deadline[];
  total: number;
}

export const deadlinesService = {
  async list(params?: DeadlineListParams): Promise<DeadlineListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.start_date) searchParams.set("start_date", params.start_date);
    if (params?.end_date) searchParams.set("end_date", params.end_date);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.priority) searchParams.set("priority", params.priority);
    if (params?.process_id) searchParams.set("process_id", params.process_id);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const url = `${API_URL}/office/deadlines${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetchWithCredentials(url);
    if (!res.ok) throw new Error("Failed to fetch deadlines");
    return res.json();
  },

  async get(id: string): Promise<Deadline> {
    const res = await fetchWithCredentials(`${API_URL}/office/deadlines/${id}`);
    if (!res.ok) throw new Error("Failed to fetch deadline");
    return res.json();
  },

  async create(data: DeadlineCreate): Promise<Deadline> {
    const res = await fetchWithCredentials(`${API_URL}/office/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create deadline");
    return res.json();
  },

  async update(id: string, data: DeadlineUpdate): Promise<Deadline> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/deadlines/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Failed to update deadline");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/deadlines/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) throw new Error("Failed to delete deadline");
  },
};
