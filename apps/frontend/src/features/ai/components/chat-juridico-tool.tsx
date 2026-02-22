import { useState, useCallback } from 'react'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { fetchWithCredentials, API_URL } from '@/lib/fetch'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import type { ChatMessage } from '../types'

export function ChatJuridicoTool() {
  const { isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { openRegisterModal } = useOutletContext<RootLayoutOutletContext>()

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading) return

    if (!isAuthenticated) {
      openRegisterModal()
      return
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
    }

    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetchWithCredentials(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          openRegisterModal()
          return
        }
        throw new Error('Erro ao processar sua mensagem. Tente novamente.')
      }

      const data = (await response.json()) as { response?: string }
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Desculpe, não consegui processar sua mensagem.',
      }
      setChatMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente mais tarde.',
      }
      setChatMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsChatLoading(false)
    }
  }, [chatInput, isChatLoading, isAuthenticated, openRegisterModal])

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col max-h-[calc(100vh-18rem)]">
      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {chatMessages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Olá! Sou seu assistente jurídico. Como posso ajudar?</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' ? (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : null}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' ? (
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
              ) : null}
            </div>
          ))
        )}

        {isChatLoading ? (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-4">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendChatMessage()
              }
            }}
            placeholder="Digite sua pergunta..."
            className="flex-1 resize-none bg-background border border-input rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary min-h-[48px] max-h-[200px]"
            rows={1}
          />
          <button
            type="button"
            onClick={sendChatMessage}
            disabled={!chatInput.trim() || isChatLoading}
            className={cn(
              "inline-flex items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed px-5",
              isDark ? "bg-slate-800 text-white hover:bg-slate-700" : "!bg-[#0d1c34] !text-white hover:!bg-[#0d1c34]/90"
            )}
            aria-label="Enviar mensagem"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
