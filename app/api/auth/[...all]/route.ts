import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * Better Auth API route handler with rate limiting and reverse proxy cookie fix
 *
 * CRITICAL FIX for reverse proxy:
 * Better Auth sees http://bettershift:3000 internally and refuses to set
 * secure cookies. We intercept the response and fix the Set-Cookie headers.
 */

const handlers = toNextJsHandler(auth);

/**
 * Fix Set-Cookie headers in response for reverse proxy
 * Ensures cookies work when accessed via HTTPS through Caddy
 */
function fixCookiesInResponse(response: Response): Response {
  // Clone response to modify headers
  const newHeaders = new Headers(response.headers);

  // Get all Set-Cookie headers
  const cookies = response.headers.getSetCookie?.() || [];

  if (cookies.length > 0) {
    // Clear old Set-Cookie headers
    newHeaders.delete("set-cookie");

    // Re-add cookies with corrected attributes
    cookies.forEach((cookie) => {
      // Ensure Secure and SameSite=None are set
      let fixedCookie = cookie;

      // Add Secure if missing
      if (!cookie.toLowerCase().includes("secure")) {
        fixedCookie += "; Secure";
      }

      // Fix or add SameSite=None
      if (!cookie.toLowerCase().includes("samesite")) {
        fixedCookie += "; SameSite=None";
      } else if (cookie.toLowerCase().includes("samesite=lax")) {
        fixedCookie = fixedCookie.replace(/SameSite=Lax/i, "SameSite=None");
      }

      newHeaders.append("set-cookie", fixedCookie);
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// Wrap POST handler for rate limiting
const originalPost = handlers.POST;

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Rate limiting for auth endpoints
  const isOAuthCallback =
    pathname.includes("/callback/") || pathname.endsWith("/sign-in/social");
  const isRegister =
    pathname.endsWith("/sign-up/email") || pathname.includes("/register");

  if (!isOAuthCallback) {
    const rateLimitType = isRegister ? "register" : "auth";
    const rateLimitResponse = rateLimit(req, null, rateLimitType);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // Call Better Auth handler and fix cookies in response
  const response = await originalPost(req);
  return fixCookiesInResponse(response);
};

// Wrap GET handler
const originalGet = handlers.GET;

export const GET = async (req: NextRequest) => {
  const response = await originalGet(req);
  return fixCookiesInResponse(response);
};
