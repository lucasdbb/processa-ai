import { fetchWithCredentials, API_URL } from '@/lib/fetch'

interface DocumentDownloadResponse {
  document_id: string
  download_url: string
  expires_in: number
  filename?: string
}

/**
 * Fetches a fresh signed URL for a generated document and triggers a browser
 * download. Used by both AI tools and calculators so the "Baixar PDF" / "Baixar
 * Word" buttons always hit a live signed URL (old URLs expire).
 *
 * Throws on non-2xx responses so callers can display a toast.
 */
export async function downloadGeneratedDocument(
  documentId: string,
  fallbackFilename: string
): Promise<void> {
  const res = await fetchWithCredentials(
    `${API_URL}/ai/documents/${encodeURIComponent(documentId)}/download`
  )

  if (!res.ok) {
    let detail = 'Falha ao obter link de download'
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      // ignore parse failures
    }
    const err = new Error(detail) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  const data = (await res.json()) as DocumentDownloadResponse
  const filename = data.filename || fallbackFilename

  const blobRes = await fetch(data.download_url)
  if (!blobRes.ok) {
    throw new Error('Falha ao baixar o arquivo')
  }
  const blob = await blobRes.blob()
  const objectUrl = window.URL.createObjectURL(blob)

  try {
    const element = document.createElement('a')
    element.href = objectUrl
    element.download = filename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  } finally {
    // Release the blob URL in the next tick so the click handler has a chance
    // to latch onto it in browsers that queue the navigation.
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0)
  }
}
