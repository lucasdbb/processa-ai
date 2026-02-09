import { createClient } from "@/lib/supabase/client";

export interface FetchOptions extends RequestInit {
  credentials?: RequestCredentials;
}

const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:8000"
).replace(/\/$/, "");

const INTERNAL_TOKEN = import.meta.env.VITE_INTERNAL_TOKEN || "";

export const API_URL = `${BACKEND_URL}/api/v1`;

export async function fetchWithCredentials(
  input: RequestInfo | URL,
  init?: FetchOptions,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input.startsWith("/")
        ? `${BACKEND_URL}${input}`
        : input
      : input;

  // Get Supabase session token
  const supabase = createClient();
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // If session is missing, try refreshing before giving up
  if (!session?.access_token) {
    try {
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    } catch {
      // ignore refresh errors
    }
  }

  // Add required headers
  const headers = new Headers(init?.headers);

  // Add internal token for backend authentication
  if (INTERNAL_TOKEN && !headers.has("X-Internal-Token")) {
    headers.set("X-Internal-Token", INTERNAL_TOKEN);
  }

  // Add Authorization header with Supabase JWT if available
  if (session?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const options: FetchOptions = {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
    cache: init?.cache ?? "no-store",
  };

  const method = (options.method || "GET").toUpperCase();

  let response = await fetch(url, options);

  // Auto refresh token on 401
  if (response.status === 401 && method === "GET") {
    try {
      // Try to refresh the Supabase session
      const {
        data: { session: newSession },
      } = await supabase.auth.refreshSession();

      if (newSession?.access_token) {
        // Update Authorization header with new token
        headers.set("Authorization", `Bearer ${newSession.access_token}`);

        // Retry original request with new token
        response = await fetch(url, { ...options, headers });
      } else {
        // Fallback to backend refresh endpoint
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });

        if (refreshResponse.ok) {
          response = await fetch(url, options);
        }
      }
    } catch {
      // Ignore refresh errors
    }
  }

  return response;
}
