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

  const options: FetchOptions = {
    ...init,
    credentials: init?.credentials ?? 'include',
    cache: init?.cache ?? 'no-store',
  }

  const method = (options.method || 'GET').toUpperCase()

  let response = await fetch(url, options)

  // Auto refresh token on 401 for GET requests
  if (response.status === 401 && method === 'GET') {
    try {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })

      if (refreshResponse.ok) {
        response = await fetch(url, options)
      }
    } catch {
      // Ignore refresh errors
    }
  }

  return response
}
