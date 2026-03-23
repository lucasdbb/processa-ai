import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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

// eslint-disable-next-line react-refresh/only-export-components
export async function reportError(error: Error, errorInfo?: ErrorInfo): Promise<void> {
  const errorId = `err_${Date.now()}`

  const payload = {
    error_message: `[${errorId}] ${error.name}: ${error.message}`,
    component_stack: errorInfo?.componentStack ?? undefined,
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
// Fallback UI
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  errorId: string | null
  onReset: () => void
  onReload: () => void
}

export function ErrorFallback({ errorId, onReset, onReload }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/20 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Algo deu errado</CardTitle>
          <CardDescription className="text-base pt-2">
            Pedimos desculpas pelo inconveniente.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            Nossa equipe já foi notificada automaticamente e está trabalhando para corrigir este problema o mais rápido possível.
          </p>
          
          {errorId && (
            <div className="bg-muted/50 p-2 rounded text-xs font-mono text-muted-foreground/80 break-all select-all">
              ID do erro: {errorId}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button 
            variant="outline" 
            onClick={onReload}
            className="w-full sm:w-auto gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button 
            onClick={onReset}
            className="w-full sm:w-auto gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Home className="h-4 w-4" />
            Voltar ao início
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
