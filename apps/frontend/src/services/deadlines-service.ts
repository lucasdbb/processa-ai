import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface DeadlineCreateData {
  type: string;
  process_id: string;
  date: string; // ISO datetime
  description?: string;
  reminder_days?: number[];
}

export interface DeadlineUpdateData {
  type?: string;
  date?: string; // ISO datetime
  description?: string;
  status?: "pending" | "completed" | "overdue";
  reminder_days?: number[];
}

export interface Deadline {
  id: string;
  user_id: string;
  type: string;
  process_id: string;
  process_number: string;
  client_name: string;
  date: string;
  description: string | null;
  status: "pending" | "completed" | "overdue";
  days_until: number;
  created_at: string;
  updated_at: string;
}

export interface DeadlineListResponse {
  deadlines: Deadline[];
  total: number;
  today_count: number;
  week_count: number;
  overdue_count: number;
}

export const deadlinesService = {
  async list(): Promise<DeadlineListResponse> {
    const res = await fetchWithCredentials(`${API_URL}/office/deadlines`);
    if (!res.ok) throw new Error("Failed to fetch deadlines");
    return res.json();
  },

  async get(id: string): Promise<Deadline> {
    const res = await fetchWithCredentials(`${API_URL}/office/deadlines/${id}`);
    if (!res.ok) throw new Error("Failed to fetch deadline");
    return res.json();
  },

  async create(data: DeadlineCreateData): Promise<Deadline> {
    const res = await fetchWithCredentials(`${API_URL}/office/deadlines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create deadline");
    return res.json();
  },

  async update(id: string, data: DeadlineUpdateData): Promise<Deadline> {
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
