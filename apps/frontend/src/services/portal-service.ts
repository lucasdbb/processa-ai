import { API_URL, fetchWithCredentials } from "@/lib/fetch"

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface PortalProcessStatus {
  raw: string
  label: string
  color: string
}

export interface PortalEventDocument {
  id: string
  name: string
  file_size: number | null
  mime_type: string | null
}

export interface PortalTimelineEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_type: string
  documents: PortalEventDocument[]
}

export interface PortalProcess {
  id: string
  process_number: string
  type: string
  court: string | null
  status: PortalProcessStatus
  value: number | null
  next_deadline: string | null
  recent_events: PortalTimelineEvent[]
}

export interface PortalProcessListResponse {
  processes: PortalProcess[]
  total: number
}

export interface PortalEvent {
  id: string
  title: string
  description: string | null
  start_at: string
  event_type: string
  process_number: string | null
  process_id: string | null
  is_urgent: boolean
}

export interface PortalEventsResponse {
  upcoming: PortalEvent[]
  past: PortalEvent[]
}

export interface PortalDocument {
  id: string
  name: string
  type: string
  file_size: number | null
  mime_type: string | null
  process_number: string | null
  created_at: string
}

export interface PortalDocumentsResponse {
  documents: PortalDocument[]
  total: number
}

export interface PortalFee {
  id: string
  description: string
  fee_type: string
  amount: number
  paid_amount: number
  status: string
  due_date: string | null
  paid_at: string | null
  process_number: string | null
}

export interface PortalFinancesSummary {
  total_amount: number
  total_paid: number
  total_pending: number
  total_overdue: number
}

export interface PortalFinancesResponse {
  summary: PortalFinancesSummary
  fees: PortalFee[]
}

export interface PortalMe {
  client_id: string
  client_name: string
  client_email: string | null
  lawyer_name: string
  portal_status: string
  portal_invited_at: string | null
}

// -----------------------------------------------------------------------
// Portal service (client-facing)
// -----------------------------------------------------------------------

export const portalService = {
  async getMe(): Promise<PortalMe> {
    const res = await fetchWithCredentials(`${API_URL}/portal/me`)
    if (!res.ok) throw new Error("Falha ao carregar dados do portal")
    return res.json()
  },

  async getProcesses(): Promise<PortalProcessListResponse> {
    const res = await fetchWithCredentials(`${API_URL}/portal/processes`)
    if (!res.ok) throw new Error("Falha ao carregar processos")
    return res.json()
  },

  async getEvents(): Promise<PortalEventsResponse> {
    const res = await fetchWithCredentials(`${API_URL}/portal/events`)
    if (!res.ok) throw new Error("Falha ao carregar agenda")
    return res.json()
  },

  async getDocuments(): Promise<PortalDocumentsResponse> {
    const res = await fetchWithCredentials(`${API_URL}/portal/documents`)
    if (!res.ok) throw new Error("Falha ao carregar documentos")
    return res.json()
  },

  async getDocumentDownloadUrl(documentId: string): Promise<{ url: string; expires_in: number }> {
    const res = await fetchWithCredentials(`${API_URL}/portal/documents/${documentId}/download`)
    if (!res.ok) throw new Error("Falha ao gerar link de download")
    return res.json()
  },

  async getFinances(): Promise<PortalFinancesResponse> {
    const res = await fetchWithCredentials(`${API_URL}/portal/finances`)
    if (!res.ok) throw new Error("Falha ao carregar financeiro")
    return res.json()
  },
}

// -----------------------------------------------------------------------
// Lawyer-facing invite calls
// -----------------------------------------------------------------------

export interface InviteClientResponse {
  message: string
  portal_status: string
  portal_invited_at: string | null
}

export const inviteClient = async (clientId: string): Promise<InviteClientResponse> => {
  const res = await fetchWithCredentials(`${API_URL}/office/clients/${clientId}/invite`, {
    method: "POST",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string })?.detail ?? "Erro ao enviar convite")
  }
  return res.json()
}

export const revokeClientPortalAccess = async (
  clientId: string,
): Promise<{ message: string; portal_status: string }> => {
  const res = await fetchWithCredentials(`${API_URL}/office/clients/${clientId}/revoke-access`, {
    method: "POST",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string })?.detail ?? "Erro ao revogar acesso")
  }
  return res.json()
}
