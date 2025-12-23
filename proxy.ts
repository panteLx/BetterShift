import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy for authentication and route protection (Next.js 16)
 *
 * Features:
 * - Protects routes when auth is enabled
 * - Redirects unauthenticated users to login
 * - Allows public routes (login, register, API)
 * - Stores return URL for post-login redirect
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if auth is enabled
  const authEnabled = process.env.AUTH_ENABLED === "true";

  // If auth is disabled, allow all routes
  if (!authEnabled) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/api/auth", // Better Auth API routes
    "/api/health", // Health check
  ];

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check for session cookie (Better Auth uses "better-auth.session_token")
  const sessionToken = request.cookies.get("better-auth.session_token");

  // If no session token, redirect to login with return URL
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // TODO: Optionally validate session token here
  // For now, trust the presence of the cookie

  return NextResponse.next();
}

// Configure which routes to run proxy on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
