import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export interface Note {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  content: string;
  note_type: "general" | "meeting" | "call" | "email" | "other";
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  client_id: string;
  title: string;
  content: string;
  note_type?: "general" | "meeting" | "call" | "email" | "other";
  is_pinned?: boolean;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  note_type?: "general" | "meeting" | "call" | "email" | "other";
  is_pinned?: boolean;
}

export interface NotesListResponse {
  notes: Note[];
  total: number;
}

export const notesService = {
  async list(clientId?: string): Promise<NotesListResponse> {
    const url = clientId
      ? `${API_URL}/office/notes?client_id=${clientId}`
      : `${API_URL}/office/notes`;
    const response = await fetchWithCredentials(url, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch notes");
    }

    return response.json();
  },

  async get(id: string): Promise<Note> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/notes/${id}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to fetch note");
    }

    return response.json();
  },

  async create(data: NoteCreate): Promise<Note> {
    const response = await fetchWithCredentials(`${API_URL}/office/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to create note");
    }

    return response.json();
  },

  async update(id: string, data: NoteUpdate): Promise<Note> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/notes/${id}`,
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
      throw new Error(error.detail || "Failed to update note");
    }

    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetchWithCredentials(
      `${API_URL}/office/notes/${id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to delete note");
    }
  },
};
