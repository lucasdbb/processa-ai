import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorId: string | null
}

// ---------------------------------------------------------------------------
// Error reporter — fire-and-forget, never throws
// ---------------------------------------------------------------------------

async function reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
  const errorId = `err_${Date.now()}`

  const payload = {
    error_message: `[${errorId}] ${error.name}: ${error.message}`,
    component_stack: errorInfo.componentStack ?? undefined,
    route: window.location.pathname,
    user_agent: navigator.userAgent,
  }

  try {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000').replace(/\/$/, '')
    const internalToken = import.meta.env.VITE_INTERNAL_TOKEN ?? ''

    await fetch(`${backendUrl}/api/v1/support/error-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(internalToken ? { 'X-Internal-Token': internalToken } : {}),
      },
      body: JSON.stringify(payload),
      // Short timeout so we don't block the UI
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    // Silently ignored — the backend being down must never affect the error UI
  }
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorId: null }
  }

  static getDerivedStateFromError(_error: Error): State {
    const errorId = `err_${Date.now()}`
    return { hasError: true, errorId }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Console output for local debugging
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)

    // Notify the backend — async, non-blocking
    void reportError(error, errorInfo)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorId: null })
    // Navigate to the root so we don't re-trigger the same error
    window.location.href = '/'
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return <ErrorFallback errorId={this.state.errorId} onReset={this.handleReset} onReload={this.handleReload} />
  }
}

// ---------------------------------------------------------------------------
// Fallback UI — kept in the same file intentionally so it can never fail to
// load due to a broken import graph (the boundary must always render).
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  errorId: string | null
  onReset: () => void
  onReload: () => void
}

function ErrorFallback({ errorId, onReset, onReload }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            Algo deu errado
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Já estamos resolvendo o problema. Nossa equipe foi notificada
            automaticamente e trabalha para corrigir isso o mais rápido possível.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onReload}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Voltar ao início
          </button>
        </div>

        {/* Error ID — subtle, useful for support tickets */}
        {errorId && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            {errorId}
          </p>
        )}
      </div>
    </div>
  )
}
