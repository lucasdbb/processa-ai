/**
 * Custom fetch wrapper that preserves credentials for cross-origin requests
 * This ensures that httpOnly cookies are always sent with requests
 */

export interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials
}

export const API_URL = '/api'

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace(
  /\/$/,
  ''
)

const toAbsoluteBackendUrl = (req: RequestInfo | URL): string | null => {
  if (!backendUrl) return null
  const raw = typeof req === 'string' ? req : req instanceof URL ? req.toString() : null
  if (!raw || !raw.startsWith('/')) return null
  return `${backendUrl}${raw}`
}

/**
 * Enhanced fetch that always includes credentials by default
 * and uses the native browser fetch API
 */
export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: FetchOptions
): Promise<Response> {
  const isBrowser = typeof window !== 'undefined'

  const resolvedInput: RequestInfo | URL = isBrowser ? input : (toAbsoluteBackendUrl(input) ?? input)

  const options: FetchOptions = {
    ...init,
    credentials: init?.credentials ?? (isBrowser ? 'include' : 'same-origin'),
    cache: init?.cache ?? (isBrowser ? 'no-store' : undefined),
  }

  const method = (options.method || 'GET').toUpperCase()

  const nativeFetch = (req: RequestInfo | URL, opts: FetchOptions) => {
    if (typeof window !== 'undefined' && window.fetch) {
      return window.fetch(req, opts)
    }

    return fetch(req, opts)
  }

  // CRITICAL: Get native fetch at runtime, not at import time
  // This ensures we get the real browser fetch, not Next.js polyfill
  let response: Response
  try {
    response = await nativeFetch(resolvedInput, options)
  } catch (error) {
    const fallback = toAbsoluteBackendUrl(resolvedInput)
    if (!fallback) throw error
    response = await nativeFetch(fallback, options)
  }

  if (!isBrowser || response.status !== 401 || method !== 'GET') {
    return response
  }

  try {
    let refreshResponse: Response
    try {
      refreshResponse = await nativeFetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
    } catch (error) {
      const fallback = toAbsoluteBackendUrl(`${API_URL}/auth/refresh`)
      if (!fallback) throw error
      refreshResponse = await nativeFetch(fallback, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
    }

    if (!refreshResponse.ok) {
      return response
    }

    try {
      return await nativeFetch(resolvedInput, options)
    } catch (error) {
      const fallback = toAbsoluteBackendUrl(resolvedInput)
      if (!fallback) throw error
      return await nativeFetch(fallback, options)
    }
  } catch {
    return response
  }
}
