import { API_URL, fetchWithCredentials } from "@/lib/fetch";
import { createClient } from "@/lib/supabase/client";

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
  service_id: string | null;
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
  service_id?: string;
  client_id?: string;
  description?: string;
}

export type DocumentUpdate = Partial<DocumentCreate>;

export interface DocumentListParams {
  search?: string;
  type?: "ai_analysis" | "calculation" | "petition" | "contract" | "other";
  status?: "draft" | "final" | "archived";
  process_id?: string;
  service_id?: string;
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
    if (params?.service_id) searchParams.set("service_id", params.service_id);
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

  async createWithFile(data: DocumentCreate, file: File): Promise<Document> {
    // Get user_id from Supabase session
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) throw new Error("User not authenticated");

    // 1. Request signed URL for direct upload
    const uploadUrlRes = await fetchWithCredentials(
      `${API_URL}/storage/upload-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          user_id: session.user.id,
          functionality: "office",
        }),
      },
    );
    if (!uploadUrlRes.ok) throw new Error("Failed to get upload URL");

    const uploadData = (await uploadUrlRes.json()) as {
      upload_url: string;
      storage_path: string;
      bucket: string;
    };

    // 2. Upload file directly to Supabase Storage
    const uploadRes = await fetch(uploadData.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error("Failed to upload file");

    // 3. Confirm upload and create document record
    const confirmRes = await fetchWithCredentials(
      `${API_URL}/office/documents/confirm-upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type || "other",
          status: data.status || "draft",
          storage_path: uploadData.storage_path,
          bucket: uploadData.bucket,
          file_size: file.size,
          mime_type: file.type || "application/octet-stream",
          process_id: data.process_id || null,
          service_id: data.service_id || null,
          client_id: data.client_id || null,
          description: data.description || null,
        }),
      },
    );
    if (!confirmRes.ok) throw new Error("Failed to confirm document upload");
    return confirmRes.json();
  },

  async getDownloadUrl(id: string): Promise<string> {
    const res = await fetchWithCredentials(`${API_URL}/office/documents/${id}/download`);
    if (!res.ok) throw new Error("Failed to get download URL");
    const data = await res.json();
    return data.download_url;
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
