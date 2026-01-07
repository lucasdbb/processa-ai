/**
 * Custom fetch wrapper that preserves credentials for cross-origin requests
 * This ensures that httpOnly cookies are always sent with requests
 */

export interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

export const API_URL = '/api';

/**
 * Enhanced fetch that always includes credentials by default
 * and uses the native browser fetch API
 */
export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: FetchOptions
): Promise<Response> {
  const options: FetchOptions = {
    ...init,
    // Force credentials to 'include' unless explicitly set to something else
    credentials: init?.credentials ?? 'include',
    // Disable Next.js caching
    cache: init?.cache ?? 'no-store',
  };

  const method = (options.method || 'GET').toUpperCase();

  const nativeFetch = (req: RequestInfo | URL, opts: FetchOptions) => {
    if (typeof window !== 'undefined' && window.fetch) {
      return window.fetch(req, opts);
    }

    return fetch(req, opts);
  };

  // CRITICAL: Get native fetch at runtime, not at import time
  // This ensures we get the real browser fetch, not Next.js polyfill
  const response = await nativeFetch(input, options);

  if (response.status !== 401 || method !== 'GET') {
    return response;
  }

  try {
    const refreshResponse = await nativeFetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!refreshResponse.ok) {
      return response;
    }

    return await nativeFetch(input, options);
  } catch {
    return response;
  }
}
