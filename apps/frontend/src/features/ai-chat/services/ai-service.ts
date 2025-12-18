import { fetchWithCredentials } from '@/lib/fetch'

const API_URL = '/api'

export const aiService = {
  async sendMessage(message: string, sessionId?: string): Promise<string> {
    const response = await fetchWithCredentials(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao enviar mensagem')
    }

    const data = await response.json()
    return data.response
  },
}
