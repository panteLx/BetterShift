import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthEnabled, allowGuestAccess } from "@/lib/auth/feature-flags";
import {
  validateAccessToken,
  storeTokenInCookie,
  updateTokenUsage,
} from "@/lib/auth/token-auth";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth/admin";

/**
 * Proxy for authentication and route protection (Next.js 16)
 *
 * Features:
 * - Protects routes when auth is enabled
 * - Redirects unauthenticated users to login (unless guest access enabled)
 * - Allows public routes (login, register, API)
 * - Stores return URL for post-login redirect
 * - Supports guest access for viewing calendars
 * - Handles access token sharing (/share/token/xyz)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // =====================================================
  // Access Token Handling (/share/token/[token])
  // =====================================================
  if (pathname.startsWith("/share/token/")) {
    const token = pathname.split("/share/token/")[1];

    if (token) {
      // Rate limit: 10 requests per minute per IP
      const rateLimitResponse = rateLimit(request, null, "token-validation");
      if (rateLimitResponse) return rateLimitResponse;

      // Validate the token
      const validation = await validateAccessToken(token);

      if (validation) {
        // Token is valid - store in cookie and redirect to calendar
        const response = NextResponse.redirect(
          new URL(`/?id=${validation.calendarId}`, request.url)
        );

        storeTokenInCookie(
          token,
          validation.calendarId,
          validation.permission,
          response,
          request // Pass request to read existing tokens
        );

        // Update usage stats (non-blocking)
        void updateTokenUsage(validation.id);

        // Audit log: Token used
        void logAuditEvent({
          userId: null, // Token access is anonymous
          action: "calendar_token_used",
          resourceType: "calendar",
          resourceId: validation.calendarId,
          metadata: {
            tokenId: validation.id,
            calendarName: validation.calendarName,
            permission: validation.permission,
          },
          request,
          severity: "info",
          isUserVisible: false,
        });

        return response;
      } else {
        // Invalid token - audit log and redirect to home with error
        void logAuditEvent({
          userId: null,
          action: "calendar_token_invalid",
          resourceType: "calendar",
          resourceId: null,
          metadata: {
            tokenPreview: `${token.slice(0, 6)}...`,
          },
          request,
          severity: "warning",
          isUserVisible: false,
        });

        const response = NextResponse.redirect(new URL("/", request.url));
        // Could set a query param to show error toast on client
        return response;
      }
    }
  }

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

  // =====================================================
  // Admin Panel Protection (/admin/*)
  // =====================================================
  if (pathname.startsWith("/admin")) {
    // Admin panel requires authentication (no guest access)
    // Check both secure and non-secure cookie names
    const sessionToken =
      request.cookies.get("__Secure-better-auth.session_token") ||
      request.cookies.get("better-auth.session_token");

    if (!sessionToken) {
      // Not authenticated - redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Validate session and check admin role
    try {
      const session = await auth.api.getSession({ headers: request.headers });

      if (!session?.user) {
        // Invalid session - redirect to login
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("returnUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check if user is admin
      if (!isAdmin(session.user)) {
        // Not an admin - redirect to home with error
        const homeUrl = new URL("/", request.url);
        homeUrl.searchParams.set("error", "admin_access_required");

        // Audit log: Unauthorized admin access attempt
        void logAuditEvent({
          userId: session.user.id,
          action: "admin_access_denied",
          resourceType: "admin",
          resourceId: null,
          metadata: {
            attemptedPath: pathname,
            userRole: session.user.role || "user",
          },
          request,
          severity: "warning",
          isUserVisible: false,
        });

        return NextResponse.redirect(homeUrl);
      }
    } catch (error) {
      console.error("[Proxy] Admin access check failed:", error);
      // Session validation failed - redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Check for session cookie (Better Auth uses "better-auth.session_token")
  // When useSecureCookies is enabled, it adds __Secure- prefix
  const sessionToken =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token");

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
