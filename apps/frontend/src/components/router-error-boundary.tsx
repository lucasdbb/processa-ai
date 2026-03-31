import { useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ErrorFallback, reportError } from './error-boundary'

export function RouterErrorBoundary() {
  const error = useRouteError()
  const [errorId, setErrorId] = useState<string | null>(null)

  useEffect(() => {
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
