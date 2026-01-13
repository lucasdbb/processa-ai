'use client'

import { useState } from 'react'
import { aiService } from '../services/ai-service'
import type { Message } from '../types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    setMessages([userMessage])
    setIsLoading(true)

    try {
      const response = await aiService.sendMessage(content)

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }

      setMessages([userMessage, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
        timestamp: new Date(),
      }
      setMessages([userMessage, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const clearMessages = () => {
    setMessages([])
  }

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  }
}
