'use client'

import { useEffect, useRef } from 'react'
import { Bot, User, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useChat } from '../hooks/use-chat'
import { useState } from 'react'

type ChatInterfaceProps = {
  isAuthenticated: boolean
  onRequireAuth: () => void
}

export function ChatInterface({ isAuthenticated, onRequireAuth }: ChatInterfaceProps) {
  const { messages, isLoading, sendMessage } = useChat()
  const [input, setInput] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAuthenticated) {
      onRequireAuth()
      return
    }

    if (input.trim() && !isLoading) {
      sendMessage(input)
      setInput('')
    }
  }

  return (
    <Card className="flex flex-col max-h-[calc(100vh-18rem)]">
      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-16 w-16 text-slate-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">IA Jurídica</h3>
            <p className="text-muted-foreground max-w-md">
              Olá! Sou seu assistente jurídico inteligente. Faça uma pergunta sobre direito e
              terei prazer em ajudar!
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-secondary-500 text-white'
              }`}
            >
              {message.role === 'user' ? (
                <User className="h-5 w-5" />
              ) : (
                <Bot className="h-5 w-5" />
              )}
            </div>

            <div
              className={`flex-1 rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs text-muted-foreground mt-2 block">
                {message.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary-500 text-white flex items-center justify-center">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 rounded-lg p-4 bg-gray-100">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-slate-800 hover:bg-slate-900"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
