import { API_URL, fetchWithCredentials } from "@/lib/fetch";

export type EventType = "audiencia" | "prazo" | "reuniao" | "other";
export type EventStatus = "confirmed" | "tentative" | "cancelled";
export type SyncStatus = "synced" | "pending_sync" | "conflict";

export type DeadlinePriority = "low" | "medium" | "high" | "urgent";
export type DeadlineStatus = "pending" | "completed" | "cancelled";

export interface CalendarEvent {
  id: string;
  user_id: string;
  calendar_id: string | null;
  google_event_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  event_type: EventType;
  status: EventStatus;
  processo_id: string | null;
  cliente_id: string | null;
  color: string | null;
  reminder_minutes: number[];
  source: "local" | "google";
  sync_status: SyncStatus;
  priority: DeadlinePriority | null;
  deadline_status: DeadlineStatus | null;
  completed_at: string | null;
  reminder_days_before: number | null;
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  title: string;
  description?: string;
  location?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  event_type?: EventType;
  calendar_id?: string;
  processo_id?: string;
  cliente_id?: string;
  color?: string;
  reminder_minutes?: number[];
  priority?: DeadlinePriority;
  deadline_status?: DeadlineStatus;
  reminder_days_before?: number;
}

export interface EventUpdate {
  title?: string;
  description?: string;
  location?: string;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  event_type?: EventType;
  processo_id?: string;
  cliente_id?: string;
  color?: string;
  reminder_minutes?: number[];
  priority?: DeadlinePriority;
  deadline_status?: DeadlineStatus;
  reminder_days_before?: number;
}

export interface EventListResponse {
  events: CalendarEvent[];
  total: number;
}

export interface GoogleSyncStatus {
  connected: boolean;
  email: string | null;
  expires_at: string | null;
  scopes: string[];
}

export interface SyncResponse {
  success: boolean;
  events_added: number;
  events_updated: number;
  events_deleted: number;
  message: string | null;
}

export const calendarService = {
  // Events CRUD
  async listEvents(
    start: string,
    end: string,
    params?: {
      calendar_id?: string;
      event_type?: EventType;
      priority?: DeadlinePriority;
      deadline_status?: DeadlineStatus;
    },
  ): Promise<EventListResponse> {
    const searchParams = new URLSearchParams({ start, end });
    if (params?.calendar_id)
      searchParams.set("calendar_id", params.calendar_id);
    if (params?.event_type)
      searchParams.set("event_type", params.event_type);
    if (params?.priority)
      searchParams.set("priority", params.priority);
    if (params?.deadline_status)
      searchParams.set("deadline_status", params.deadline_status);
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/events?${searchParams}`,
    );
    if (!res.ok) throw new Error("Erro ao listar eventos");
    return res.json();
  },

  async getEvent(id: string): Promise<CalendarEvent> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/events/${id}`,
    );
    if (!res.ok) throw new Error("Erro ao buscar evento");
    return res.json();
  },

  async createEvent(data: EventCreate): Promise<CalendarEvent> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Erro ao criar evento");
    return res.json();
  },

  async updateEvent(
    id: string,
    data: EventUpdate,
  ): Promise<CalendarEvent> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/events/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!res.ok) throw new Error("Erro ao atualizar evento");
    return res.json();
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/events/${id}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("Erro ao excluir evento");
  },

  // Google Calendar Integration
  async getGoogleStatus(): Promise<GoogleSyncStatus> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/google/status`,
    );
    if (!res.ok) throw new Error("Erro ao verificar status do Google");
    return res.json();
  },

  async connectGoogle(): Promise<{ auth_url: string }> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/google/connect`,
    );
    if (!res.ok) throw new Error("Erro ao conectar Google Calendar");
    return res.json();
  },

  async syncToGoogle(): Promise<SyncResponse> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/google/sync`,
      { method: "POST" },
    );
    if (!res.ok) throw new Error("Erro ao sincronizar com Google");
    return res.json();
  },

  async disconnectGoogle(): Promise<void> {
    const res = await fetchWithCredentials(
      `${API_URL}/office/calendar/google/disconnect`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error("Erro ao desconectar Google Calendar");
  },
};
