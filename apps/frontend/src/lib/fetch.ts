import { createClient } from '@/lib/supabase/client'

export interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '')

export const API_URL = `${BACKEND_URL}/api`

export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: FetchOptions
): Promise<Response> {
  const url = typeof input === 'string'
    ? (input.startsWith('/') ? `${BACKEND_URL}${input}` : input)
    : input

  // Get Supabase session token
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  // Add Authorization header with Supabase JWT if available
  const headers = new Headers(init?.headers)
  if (session?.access_token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const options: FetchOptions = {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
    cache: init?.cache ?? 'no-store',
  }

  const method = (options.method || 'GET').toUpperCase()

  let response = await fetch(url, options)

  // Auto refresh token on 401
  if (response.status === 401 && method === 'GET') {
    try {
      // Try to refresh the Supabase session
      const { data: { session: newSession } } = await supabase.auth.refreshSession()

      if (newSession?.access_token) {
        // Update Authorization header with new token
        headers.set('Authorization', `Bearer ${newSession.access_token}`)

        // Retry original request with new token
        response = await fetch(url, { ...options, headers })
      } else {
        // Fallback to backend refresh endpoint
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        })

        if (refreshResponse.ok) {
          response = await fetch(url, options)
        }
      }
    } catch {
      // Ignore refresh errors
    }
  }

  return response
}
