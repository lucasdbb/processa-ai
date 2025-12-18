/**
 * Custom fetch wrapper that preserves credentials for cross-origin requests
 * This ensures that httpOnly cookies are always sent with requests
 */

// Store reference to native fetch before Next.js can override it
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

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

  // Use native fetch if in browser, otherwise use Next.js fetch
  const fetchFn = typeof window !== 'undefined' ? nativeFetch : fetch;

  return fetchFn(input, options);
}
