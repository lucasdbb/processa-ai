import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface Document {
  id: string;
  user_id: string;
  name: string;
  type: "ai_analysis" | "calculation" | "petition" | "contract" | "other";
  status: "draft" | "final" | "archived";
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  process_id: string | null;
  client_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentCreate {
  name: string;
  type?: "ai_analysis" | "calculation" | "petition" | "contract" | "other";
  status?: "draft" | "final" | "archived";
  file_url?: string;
  file_size?: number;
  mime_type?: string;
  process_id?: string;
  client_id?: string;
  description?: string;
}

export type DocumentUpdate = Partial<DocumentCreate>;

export interface DocumentListParams {
  search?: string;
  type?: "ai_analysis" | "calculation" | "petition" | "contract" | "other";
  status?: "draft" | "final" | "archived";
  process_id?: string;
  client_id?: string;
  limit?: number;
  offset?: number;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

export const documentsService = {
  async list(params?: DocumentListParams): Promise<DocumentListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.process_id) searchParams.set("process_id", params.process_id);
    if (params?.client_id) searchParams.set("client_id", params.client_id);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const url = `${API_URL}/office/documents${searchParams.toString() ? `?${searchParams}` : ""}`;
    const res = await fetchWithCredentials(url);
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  async get(id: string): Promise<Document> {
    const res = await fetchWithCredentials(`${API_URL}/office/documents/${id}`);
    if (!res.ok) throw new Error("Failed to fetch document");
    return res.json();
  },

  async create(data: DocumentCreate): Promise<Document> {
    const res = await fetchWithCredentials(`${API_URL}/office/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create document");
    return res.json();
  },

  async update(id: string, data: DocumentUpdate): Promise<Document> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/documents/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Failed to update document");
    return res.json();
  },

  async delete(id: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/documents/${id}`,
      {
        method: "DELETE",
      },
    );
    if (!res.ok) throw new Error("Failed to delete document");
  },
};
