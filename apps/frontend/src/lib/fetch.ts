/**
 * Custom fetch wrapper that preserves credentials for cross-origin requests
 * This ensures that httpOnly cookies are always sent with requests
 */

export interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

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

  // CRITICAL: Get native fetch at runtime, not at import time
  // This ensures we get the real browser fetch, not Next.js polyfill
  if (typeof window !== 'undefined' && window.fetch) {
    // We're in the browser - use native fetch directly
    return window.fetch(input, options);
  }

  // We're on the server - use Next.js fetch (but this shouldn't happen for auth)
  return fetch(input, options);
}
