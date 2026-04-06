import { API_URL, fetchWithCredentials } from '@/lib/fetch'

export interface DataExportRequestResponse {
  job_id: string
  status: string
  message: string
}

export const dataExportService = {
  async requestMyDataExport(): Promise<DataExportRequestResponse> {
    const res = await fetchWithCredentials(`${API_URL}/profiles/me/export-data`, {
      method: 'POST',
    })

    if (!res.ok) {
      let detail = 'Não foi possível iniciar a exportação agora.'
      try {
        const data = (await res.json()) as { detail?: string }
        if (data?.detail) detail = data.detail
      } catch {
        // Keep fallback detail when response has no JSON body.
      }
      throw new Error(detail)
    }

    return res.json()
  },
}
