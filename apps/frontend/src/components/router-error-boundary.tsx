import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ErrorFallback, reportError } from './error-boundary'

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.name === 'ChunkLoadError'
  )
}

export function RouterErrorBoundary() {
  const error = useRouteError()
  const [errorId, setErrorId] = useState<string | null>(null)

  useEffect(() => {
    // Auto-reload once for chunk load errors (stale deploy)
    if (isChunkLoadError(error)) {
      const reloadKey = 'chunk_reload_' + window.location.pathname
      const lastReload = sessionStorage.getItem(reloadKey)
      const now = Date.now()

      if (!lastReload || now - Number(lastReload) > 30_000) {
        sessionStorage.setItem(reloadKey, String(now))
        window.location.reload()
        return
      }
    }

    // Generate an ID for tracking
    const id = `err_${Date.now()}`
    setErrorId(id)

    // Normalize error for reporting
    let errorObj: Error

    if (isRouteErrorResponse(error)) {
      // It's a 4xx/5xx response thrown by a loader/action
      errorObj = new Error(`${error.status} ${error.statusText}: ${error.data}`)
      errorObj.name = 'RouteErrorResponse'
    } else if (error instanceof Error) {
      errorObj = error
    } else {
      errorObj = new Error(String(error))
      errorObj.name = 'UnknownRouteError'
    }

    // Report to backend (fire-and-forget)
    void reportError(errorObj)
  }, [error])

  const handleReset = () => {
    window.location.href = '/'
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <ErrorFallback
      errorId={errorId}
      onReset={handleReset}
      onReload={handleReload}
    />
  )
}
