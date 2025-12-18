const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000')
const API_URL = `${BACKEND_URL}/api`

export const aiService = {
  async sendMessage(message: string, sessionId?: string): Promise<string> {
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
      credentials: 'include',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Erro ao enviar mensagem')
    }

    const data = await response.json()
    return data.response
  },
}
