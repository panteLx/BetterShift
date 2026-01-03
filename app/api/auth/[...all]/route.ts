import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * Better Auth API route handler with rate limiting and proxy support
 *
 * CRITICAL: Behind reverse proxy (Caddy), Better Auth sees internal HTTP requests
 * (http://bettershift:3000) instead of external HTTPS (https://bs.ssx.si).
 * This causes cookies to NOT be set because `secure: true` requires HTTPS.
 *
 * Solution: Read X-Forwarded-Proto/Host headers from Caddy and reconstruct the
 * external HTTPS URL so Better Auth sets cookies correctly.
 */

const handlers = toNextJsHandler(auth);

/**
 * Fix request URL for reverse proxy scenarios
 * Better Auth uses req.url to determine if connection is secure
 */
function fixProxyUrl(req: NextRequest): NextRequest {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");

  // Only fix if we have proxy headers indicating HTTPS
  if (forwardedProto === "https" && forwardedHost) {
    const url = new URL(req.url);

    // Reconstruct external HTTPS URL
    url.protocol = "https:";
    url.host = forwardedHost;

    // Create new request with corrected URL
    return new NextRequest(url, req);
  }

  return req;
}

// Wrap POST handler for rate limiting and proxy support
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

  // Fix URL for reverse proxy before Better Auth sees it
  const fixedReq = fixProxyUrl(req);

  return await originalPost(fixedReq);
};

// Wrap GET handler for proxy support
const originalGet = handlers.GET;

export const GET = async (req: NextRequest) => {
  const fixedReq = fixProxyUrl(req);
  return await originalGet(fixedReq);
};
