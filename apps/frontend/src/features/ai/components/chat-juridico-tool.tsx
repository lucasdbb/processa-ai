import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  Bot, Loader2, Send, User, Plus, MessageSquare, Trash2,
  ChevronLeft, BookOpen, ChevronDown, ChevronUp, Scale,
  AlertCircle, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useTheme } from 'next-themes'
import { useUser } from '@/features/auth/hooks/use-user'
import { useOnboardingStore } from '@/features/onboarding'
import { useOutletContext } from 'react-router-dom'
import type { RootLayoutOutletContext } from '@/components/layout/root-layout'
import { analytics } from '@/lib/analytics'
import { useChatSessions, type ChatSource } from '../hooks/use-chat-sessions'
import { useChatStream } from '../hooks/use-chat-stream'
import { useCreditsStore } from '@/stores/credits-store'
import { toast } from 'sonner'

// ── Markdown rendering ──────────────────────────────────

function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { async: false, breaks: true }) as string
  return DOMPurify.sanitize(raw)
}

// ── Typing indicator ────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
    </div>
  )
}

// ── Source card ──────────────────────────────────────────

function SourceCard({ source }: { source: ChatSource }) {
  const [showOriginal, setShowOriginal] = useState(false)

  const label = [source.artigo, source.legislacao].filter(Boolean).join(', ') || source.section_title || source.area
  const areaLabel = source.area.charAt(0).toUpperCase() + source.area.slice(1)
  const hasResumo = source.resumo && source.resumo.length > 0
  const displayText = hasResumo ? source.resumo : source.content

  const statusConfig: Record<string, { label: string; className: string }> = {
    revogado: { label: 'Revogado', className: 'bg-red-500/10 text-red-600 dark:text-red-400' },
    alterado: { label: 'Alterado', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  }
  const statusInfo = statusConfig[source.status]

  return (
    <div className="rounded-lg bg-muted/60 border border-border/60 px-3 py-2.5 text-xs">
      <div className="flex items-start gap-2">
        <Scale className="h-3.5 w-3.5 text-primary/70 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          {/* Header: label + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{label}</span>
            <span className="rounded-full bg-primary/10 text-primary/80 px-2 py-0.5 text-[10px] font-medium">
              {areaLabel}
            </span>
            {source.tema ? (
              <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px]">
                {source.tema}
              </span>
            ) : null}
            {statusInfo ? (
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusInfo.className)}>
                {statusInfo.label}
              </span>
            ) : null}
            <span className="text-muted-foreground/60 text-[10px]">
              {Math.round(source.score * 100)}% relevância
            </span>
          </div>

          {/* Revogado por info */}
          {source.revogado_por ? (
            <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 italic">
              Alterado/revogado por: {source.revogado_por}
            </p>
          ) : null}

          {/* Main text: resumo (complete) or content fallback */}
          {displayText ? (
            <p className="mt-1.5 text-muted-foreground leading-relaxed">
              {hasResumo ? (
                <span>{displayText}</span>
              ) : (
                <span className="line-clamp-3">{displayText}</span>
              )}
            </p>
          ) : null}

          {/* Toggle to see original text */}
          {hasResumo && source.content ? (
            <div className="mt-1.5">
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                className="text-[10px] text-primary/60 hover:text-primary/80 transition-colors underline underline-offset-2"
              >
                {showOriginal ? 'Ocultar texto original' : 'Ver texto original'}
              </button>
              {showOriginal ? (
                <p className="mt-1 text-muted-foreground/70 leading-relaxed text-[11px] border-l-2 border-primary/20 pl-2">
                  {source.content}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Sources panel ───────────────────────────────────────

function SourcesBadges({ sources }: { sources: ChatSource[] }) {
  const [expanded, setExpanded] = useState(false)

  // Deduplicate by legislacao+artigo, keeping highest score
  const uniqueSources = useMemo(() => {
    const map = new Map<string, ChatSource>()
    for (const s of sources) {
      const key = `${s.legislacao}::${s.artigo}`
      const existing = map.get(key)
      if (!existing || s.score > existing.score) {
        map.set(key, s)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.score - a.score)
  }, [sources])

  if (sources.length === 0) return null

  return (
    <div className="mt-2 ml-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary/80 bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>{uniqueSources.length} fonte{uniqueSources.length > 1 ? 's' : ''} da base de conhecimento</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded ? (
        <div className="mt-2 space-y-1.5">
          {uniqueSources.map((s, i) => (
            <SourceCard key={i} source={s} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Suggested questions ─────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'Quais são os direitos do trabalhador na rescisão sem justa causa?',
  'Como funciona o cálculo de horas extras na CLT?',
  'Qual o prazo para contestação em ação trabalhista?',
  'O que diz a lei sobre danos morais no trabalho?',
]

// ── Main component ──────────────────────────────────────

export function ChatJuridicoTool() {
  const { isAuthenticated } = useUser()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const outletContext = useOutletContext<RootLayoutOutletContext | null>()
  
  const openRegisterModal = useMemo(
    () => outletContext?.openRegisterModal || (() => {}),
    [outletContext?.openRegisterModal]
  )

  const { markAiToolUsed } = useOnboardingStore()

  const {
    sessions,
    activeSession,
    messages,
    createSession,
    loadSession,
    deleteSession,
    addMessage,
    updateLastMessage,
  } = useChatSessions()

  const { sendMessage, isStreaming } = useChatStream()
  const { costs } = useCreditsStore()
  const sessionCost = useMemo(() => {
    const item = costs.find((c) => c.feature_key === 'ai_chat_session')
    return item ? item.cost : 3
  }, [costs])

  const [chatInput, setChatInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const streamContentRef = useRef('')

  // Auto-scroll during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [chatInput])

  const handleNewSession = useCallback(async () => {
    if (!isAuthenticated) {
      openRegisterModal()
      return
    }
    setIsCreating(true)
    try {
      await createSession()
      setShowSidebar(false)
      analytics.track('feature_used', { feature: 'chat_juridico', action: 'session_created' })
    } catch (err) {
      toast.error((err as Error).message || 'Erro ao criar sessão')
    } finally {
      setIsCreating(false)
    }
  }, [isAuthenticated, openRegisterModal, createSession])

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      await loadSession(sessionId)
      setShowSidebar(false)
    },
    [loadSession],
  )

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      const ok = await deleteSession(sessionId)
      if (ok) toast.success('Sessão removida')
    },
    [deleteSession],
  )

  const doSend = useCallback(async (text: string) => {
    const userContent = text.trim()
    if (!userContent || isStreaming || !activeSession) return

    setChatInput('')

    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userContent,
      created_at: new Date().toISOString(),
    })

    addMessage({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    })

    streamContentRef.current = ''

    analytics.track('feature_used', {
      feature: 'chat_juridico',
      action: 'message_sent',
      message_length: userContent.length,
    })

    await sendMessage(
      activeSession.id,
      userContent,
      (chunk) => {
        streamContentRef.current += chunk
        updateLastMessage(streamContentRef.current)
      },
      (_messageId, sources) => {
        markAiToolUsed()
        if (sources && sources.length > 0) {
          updateLastMessage(streamContentRef.current, sources as ChatSource[])
        }
        analytics.track('feature_used', {
          feature: 'chat_juridico',
          action: 'response_received',
          response_length: streamContentRef.current.length,
          sources_count: sources?.length ?? 0,
        })
      },
      (error) => {
        updateLastMessage(`Erro: ${error}`)
        analytics.track('feature_used', {
          feature: 'chat_juridico',
          action: 'failed',
          success: false,
        })
      },
    )
  }, [isStreaming, activeSession, addMessage, updateLastMessage, sendMessage, markAiToolUsed])

  const handleSend = useCallback(() => {
    void doSend(chatInput)
  }, [chatInput, doSend])

  const handleSuggestion = useCallback((q: string) => {
    void doSend(q)
  }, [doSend])

  // Format relative time
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `${diffMin}min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h`
    const diffD = Math.floor(diffH / 24)
    return `${diffD}d`
  }

  // ── Sidebar ─────────────────────────────────────────────

  const sidebar = (
    <div
      className={cn(
        'flex flex-col border-r border-border bg-muted/20 h-full',
        showSidebar ? 'w-full md:w-72' : 'hidden md:flex md:w-72',
      )}
    >
      <div className="p-3 border-b border-border">
        <button
          type="button"
          onClick={handleNewSession}
          disabled={isCreating}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50',
            isDark
              ? 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
              : 'bg-slate-900 text-white hover:bg-slate-800',
          )}
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nova sessão
          <span className="rounded-full bg-yellow-500/20 text-yellow-300 dark:text-yellow-400 px-2 py-0.5 text-[11px] font-semibold">
            {sessionCost} cr
          </span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground/60">
              Nenhuma sessão ainda
            </p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => void handleSelectSession(session.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm rounded-lg transition-colors group',
                  activeSession?.id === session.id
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <MessageSquare className={cn(
                  'h-4 w-4 flex-shrink-0',
                  activeSession?.id === session.id ? 'text-primary' : 'text-muted-foreground/50',
                )} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-[13px]">
                    {session.title || 'Nova sessão'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground/60">
                      {session.message_count} msg{session.message_count !== 1 ? 's' : ''}
                    </span>
                    {session.status !== 'active' ? (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-amber-500/80">
                          {session.status === 'expired' ? 'expirada' : 'encerrada'}
                        </span>
                      </>
                    ) : null}
                    {session.created_at ? (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-muted-foreground/50">
                          {formatTime(session.created_at)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 rounded-md transition-all"
                  aria-label="Remover sessão"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar footer */}
      <div className="p-3 border-t border-border/50 space-y-1">
        <div className="flex items-start gap-2 px-2 text-[11px] text-muted-foreground/50 leading-relaxed">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>Cada sessão permite até 50 mensagens e expira após 30 min de inatividade.</span>
        </div>
      </div>
    </div>
  )

  // ── Chat area ───────────────────────────────────────────

  const chatArea = (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-background/50">
      {/* Mobile: back button to sidebar */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50">
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-foreground truncate">
          {activeSession?.title || 'Chat Jurídico'}
        </span>
        {activeSession ? (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {activeSession.message_count}/{activeSession.max_messages}
          </span>
        ) : null}
      </div>

      {/* Messages */}
      <div className={cn(
        'flex-1 min-h-0 overflow-y-auto',
        (!activeSession || messages.length === 0) && 'flex items-center justify-center',
      )}>
        <div className={cn(
          'max-w-3xl mx-auto px-4 md:px-6',
          messages.length > 0 ? 'py-4 space-y-5 w-full' : 'w-full',
        )}>
          {!activeSession ? (
            /* ── Welcome state ── */
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-1">
                Assistente Jurídico
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Tire dúvidas sobre direito brasileiro com respostas fundamentadas em legislação real.
              </p>
              <button
                type="button"
                onClick={handleNewSession}
                disabled={isCreating}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-50',
                  isDark
                    ? 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
                    : 'bg-slate-900 text-white hover:bg-slate-800',
                )}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Iniciar conversa
              </button>
            </div>
          ) : messages.length === 0 ? (
            /* ── Empty session state with suggestions ── */
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Como posso ajudar?
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Faça sua pergunta ou escolha uma sugestão abaixo.
              </p>
              <div className="grid gap-1.5 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestion(q)}
                    disabled={isStreaming}
                    className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/60 transition-colors text-sm text-muted-foreground hover:text-foreground group disabled:opacity-50"
                  >
                    <Scale className="h-3.5 w-3.5 text-primary/50 group-hover:text-primary flex-shrink-0" />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Messages ── */
            messages.map((message) => (
              <div key={message.id} className="group">
                {message.role === 'user' ? (
                  /* User message */
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md px-4 py-3 text-sm bg-primary text-primary-foreground">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </div>
                ) : (
                  /* Assistant message */
                  <div>
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="max-w-[85%] min-w-0">
                        {message.content ? (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-primary/30 [&_blockquote]:text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                          />
                        ) : isStreaming ? (
                          <TypingIndicator />
                        ) : null}
                      </div>
                    </div>
                    {message.sources && message.sources.length > 0 ? (
                      <div className="ml-11 mt-2">
                        <SourcesBadges sources={message.sources} />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {activeSession && activeSession.status === 'active' ? (
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-3 md:p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Faça sua pergunta jurídica..."
                  className="w-full resize-none bg-background border border-input rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary min-h-[48px] max-h-[200px] text-sm placeholder:text-muted-foreground/50 transition-shadow"
                  rows={1}
                  disabled={isStreaming}
                />
                <span className="absolute right-3 bottom-3 text-[10px] text-muted-foreground/40 pointer-events-none hidden sm:block">
                  Enter ↵
                </span>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!chatInput.trim() || isStreaming}
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0',
                  chatInput.trim() && !isStreaming
                    ? isDark
                      ? 'bg-primary text-primary-foreground hover:opacity-90'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label="Enviar mensagem"
              >
                {isStreaming ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/40 text-center">
              Respostas são orientações jurídicas, não substituem parecer profissional.
            </p>
          </div>
        </div>
      ) : activeSession ? (
        <div className="border-t border-border p-5 text-center bg-card/50">
          <div className="flex items-center justify-center gap-2 mb-3 text-amber-500/80">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm font-medium">
              Sessão {activeSession.status === 'expired' ? 'expirada por inatividade' : 'encerrada'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewSession}
            disabled={isCreating}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all disabled:opacity-50',
              isDark
                ? 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
                : 'bg-slate-900 text-white hover:bg-slate-800',
            )}
          >
            <Plus className="h-4 w-4" />
            Nova sessão
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex h-full shadow-sm">
      <div className={cn('md:block', showSidebar ? 'block w-full md:w-auto' : 'hidden')}>
        {sidebar}
      </div>
      <div className={cn('flex-1 min-w-0 md:block', showSidebar ? 'hidden md:block' : 'block')}>
        {chatArea}
      </div>
    </div>
  )
}
