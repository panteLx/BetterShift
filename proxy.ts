import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled, allowGuestAccess } from "@/lib/auth/feature-flags";

/**
 * Proxy for authentication and route protection (Next.js 16)
 *
 * Features:
 * - Protects routes when auth is enabled
 * - Redirects unauthenticated users to login (unless guest access enabled)
 * - Allows public routes (login, register, API)
 * - Stores return URL for post-login redirect
 * - Supports guest access for viewing calendars
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // If auth is disabled, allow all routes
  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/api/auth", // Better Auth API routes
    "/api/version", // Version info (always public)
    "/api/releases", // Changelog/releases (always public)
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

  // If no session token, check guest access
  if (!sessionToken) {
    // If guest access is enabled, allow viewing without login
    if (allowGuestAccess()) {
      return NextResponse.next();
    }

    // Otherwise, redirect to login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session token validation happens in API routes via getSessionUser()
  // Middleware only checks for cookie presence (fast routing decision)

  // Add security headers to response
  const response = NextResponse.next();

  // Security Headers (Defense in Depth)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (strict but allows inline scripts for Next.js hydration)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
    "style-src 'self' 'unsafe-inline'", // Required for Tailwind
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  return response;
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
