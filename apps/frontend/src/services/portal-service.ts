import { API_URL, fetchWithCredentials } from "@/lib/fetch";

function withPreviewClientId(path: string, previewClientId?: string): string {
  if (!previewClientId) {
    return `${API_URL}${path}`;
  }

  const url = new URL(`${API_URL}${path}`);
  url.searchParams.set("preview_client_id", previewClientId);
  return url.toString();
}

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface PortalProcessStatus {
  raw: string;
  label: string;
  color: string;
}

export interface PortalEventDocument {
  id: string;
  name: string;
  file_size: number | null;
  mime_type: string | null;
}

export interface PortalTimelineTranslation {
  summary: string;
  explanation: string;
  action_required: string;
  next_step: string | null;
  sentiment: "positive" | "neutral" | "negative" | "urgent";
  process_phase: string | null;
  process_phase_progress: number | null;
}

export interface PortalTimelineEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  documents: PortalEventDocument[];
  translation: PortalTimelineTranslation | null;
}

export interface PortalProcess {
  id: string;
  process_number: string;
  type: string;
  court: string | null;
  status: PortalProcessStatus;
  value: number | null;
  next_deadline: string | null;
  recent_events: PortalTimelineEvent[];
}

export interface PortalProcessListResponse {
  processes: PortalProcess[];
  total: number;
}

export interface PortalEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  event_type: string;
  process_number: string | null;
  process_id: string | null;
  is_urgent: boolean;
}

export interface PortalEventsResponse {
  upcoming: PortalEvent[];
  past: PortalEvent[];
}

export interface PortalDocument {
  id: string;
  name: string;
  type: string;
  file_size: number | null;
  mime_type: string | null;
  process_number: string | null;
  created_at: string;
}

export interface PortalDocumentsResponse {
  documents: PortalDocument[];
  total: number;
}

export interface PortalFee {
  id: string;
  description: string;
  fee_type: string;
  amount: number;
  paid_amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  process_number: string | null;
}

export interface PortalFinancesSummary {
  total_amount: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
}

export interface PortalFinancesResponse {
  summary: PortalFinancesSummary;
  fees: PortalFee[];
}

export interface PortalMe {
  client_id: string;
  client_name: string;
  client_email: string | null;
  lawyer_name: string;
  portal_status: string;
  portal_invited_at: string | null;
}

// -----------------------------------------------------------------------
// Portal service (client-facing)
// -----------------------------------------------------------------------

export const portalService = {
  async getMe(previewClientId?: string): Promise<PortalMe> {
    const res = await fetchWithCredentials(
      withPreviewClientId("/portal/me", previewClientId),
    );
    if (!res.ok) throw new Error("Falha ao carregar dados do portal");
    return res.json();
  },

  async getProcesses(
    previewClientId?: string,
  ): Promise<PortalProcessListResponse> {
    const res = await fetchWithCredentials(
      withPreviewClientId("/portal/processes", previewClientId),
    );
    if (!res.ok) throw new Error("Falha ao carregar processos");
    return res.json();
  },

  async getEvents(previewClientId?: string): Promise<PortalEventsResponse> {
    const res = await fetchWithCredentials(
      withPreviewClientId("/portal/events", previewClientId),
    );
    if (!res.ok) throw new Error("Falha ao carregar agenda");
    return res.json();
  },

  async getDocuments(
    previewClientId?: string,
  ): Promise<PortalDocumentsResponse> {
    const res = await fetchWithCredentials(
      withPreviewClientId("/portal/documents", previewClientId),
    );
    if (!res.ok) throw new Error("Falha ao carregar documentos");
    return res.json();
  },

  async getDocumentDownloadUrl(
    documentId: string,
    previewClientId?: string,
  ): Promise<{ url: string; expires_in: number }> {
    const res = await fetchWithCredentials(
      withPreviewClientId(
        `/portal/documents/${documentId}/download`,
        previewClientId,
      ),
    );
    if (!res.ok) throw new Error("Falha ao gerar link de download");
    return res.json();
  },

  async getFinances(previewClientId?: string): Promise<PortalFinancesResponse> {
    const res = await fetchWithCredentials(
      withPreviewClientId("/portal/finances", previewClientId),
    );
    if (!res.ok) throw new Error("Falha ao carregar financeiro");
    return res.json();
  },
};

// -----------------------------------------------------------------------
// Lawyer-facing invite calls
// -----------------------------------------------------------------------

export interface InviteClientResponse {
  message: string;
  portal_status: string;
  portal_invited_at: string | null;
}

export const inviteClient = async (
  clientId: string,
): Promise<InviteClientResponse> => {
  const res = await fetchWithCredentials(
    `${API_URL}/office/clients/${clientId}/invite`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string })?.detail ?? "Erro ao enviar convite",
    );
  }
  return res.json();
};

export const revokeClientPortalAccess = async (
  clientId: string,
): Promise<{ message: string; portal_status: string }> => {
  const res = await fetchWithCredentials(
    `${API_URL}/office/clients/${clientId}/revoke-access`,
    {
      method: "POST",
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string })?.detail ?? "Erro ao revogar acesso",
    );
  }
  return res.json();
};
