import { useState, useCallback, useRef } from 'react'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'

type StreamEvent = {
  text?: string
  done?: boolean
  message_id?: string
  error?: string
  sources?: Array<{
    legislacao: string
    artigo: string
    area: string
    score: number
  }>
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (
      sessionId: string,
      message: string,
      onChunk: (text: string) => void,
      onDone: (messageId: string, sources?: StreamEvent['sources']) => void,
      onError: (error: string) => void,
    ) => {
      // Abort any ongoing stream
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsStreaming(true)

      try {
        const response = await fetchWithCredentials(
          `${API_URL}/ai/chat/sessions/${sessionId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
            signal: controller.signal,
          },
        )

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { detail?: string }
          throw new Error(errorData.detail || 'Erro ao enviar mensagem')
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Stream não disponível')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE events from buffer
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event = JSON.parse(jsonStr) as StreamEvent

              if (event.error) {
                onError(event.error)
                setIsStreaming(false)
                return
              }

              if (event.text) {
                onChunk(event.text)
              }

              if (event.done && event.message_id) {
                onDone(event.message_id, event.sources)
                setIsStreaming(false)
                return
              }
            } catch {
              // Skip malformed events
            }
          }
        }

        setIsStreaming(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        onError((err as Error).message || 'Erro na conexão')
        setIsStreaming(false)
      }
    },
    [],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  return { sendMessage, isStreaming, abort }
}
