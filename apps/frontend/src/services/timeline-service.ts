import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type TimelineEventType =
  | "creation"
  | "update"
  | "deadline"
  | "document"
  | "note"
  | "status_change"
  | "hearing"
  | "petition"
  | "decision"
  | "citation"
  | "other";

export interface DocumentSummary {
  id: string;
  name: string;
  type: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface TimelineEvent {
  id: string;
  user_id: string;
  process_id: string;
  event_type: TimelineEventType;
  title: string;
  description: string | null;
  event_date: string;
  metadata: Record<string, unknown> | null;
  documents: DocumentSummary[];
  created_at: string;
  updated_at: string;
}

export interface TimelineEventCreate {
  process_id: string;
  event_type: TimelineEventType;
  title: string;
  description?: string;
  event_date?: string;
  metadata?: Record<string, unknown>;
  document_ids?: string[];
}

export interface TimelineEventUpdate {
  title?: string;
  description?: string;
  event_date?: string;
  metadata?: Record<string, unknown>;
  document_ids?: string[];
}

export interface TimelineListResponse {
  events: TimelineEvent[];
  total: number;
}

export const timelineService = {
  async list(params?: {
    process_id?: string;
    event_type?: TimelineEventType;
    limit?: number;
    offset?: number;
  }): Promise<TimelineListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.process_id) searchParams.set("process_id", params.process_id);
    if (params?.event_type) searchParams.set("event_type", params.event_type);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    const res = await fetchWithCredentials(
      `${API_URL}/office/timeline${query ? `?${query}` : ""}`,
    );
    if (!res.ok) throw new Error("Erro ao listar andamentos");
    return res.json();
  },

  async get(id: string): Promise<TimelineEvent> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/timeline/${id}`,
    );
    if (!res.ok) throw new Error("Erro ao buscar andamento");
    return res.json();
  },

  async create(data: TimelineEventCreate): Promise<TimelineEvent> {
    const res = await fetchWithCredentials(`${API_URL}/office/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao criar andamento");
    return res.json();
  },

  async update(
    id: string,
    data: TimelineEventUpdate,
  ): Promise<TimelineEvent> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/timeline/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Erro ao atualizar andamento");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/timeline/${id}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("Erro ao excluir andamento");
  },
};
