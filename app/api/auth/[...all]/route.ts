import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * Better Auth API route handler with rate limiting
 *
 * Note: Audit logging is handled by the auditLogPlugin in lib/auth/audit-plugin.ts
 * Note: Registration restrictions are handled by Better Auth's disableSignUp config
 */

const handlers = toNextJsHandler(auth);

// Wrap POST handler for rate limiting
const originalPost = handlers.POST;

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Rate limiting for auth endpoints
  // Apply different limits for login vs registration
  const isOAuthCallback =
    pathname.includes("/callback/") || pathname.endsWith("/sign-in/social");
  const isRegister =
    pathname.endsWith("/sign-up/email") || pathname.includes("/register");

  if (!isOAuthCallback) {
    // Stricter rate limit for registration (3 per 10 min) vs login (5 per 1 min)
    const rateLimitType = isRegister ? "register" : "auth";
    const rateLimitResponse = rateLimit(req, null, rateLimitType);
    if (rateLimitResponse) return rateLimitResponse;
  }

  // Call original Better Auth handler (audit logging handled by plugin)
  return await originalPost(req);
};

// Export GET handler as-is
export const GET = handlers.GET;
