import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Middleware for session management and route protection
 * Uses httpOnly cookies for secure authentication
 */
export async function updateSession(request: NextRequest) {
  // Protected routes that require authentication
  const protectedRoutes = ["/admin", "/ia-juridica", "/calculadoras"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Admin-only routes
  const adminRoutes = ["/admin"];
  const isAdminRoute = adminRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // If not a protected route, allow access
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Try to verify user session with backend using httpOnly cookies
  try {
    // Call /auth/me endpoint - backend will read httpOnly cookie automatically
    const response = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
      credentials: "include",
    });

    // If user is not authenticated, redirect to home
    if (!response.ok) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth_required", "true");
      return NextResponse.redirect(url);
    }

    const user = await response.json();

    // Check if user is admin for admin routes
    if (isAdminRoute && user.role !== "admin" && user.role !== "author") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // User is authenticated, allow access
    return NextResponse.next();
  } catch (error) {
    console.error("[Middleware] Error verifying user:", error);
    // On error, redirect to home
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth_required", "true");
    return NextResponse.redirect(url);
  }
}
