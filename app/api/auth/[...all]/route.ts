import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest } from "next/server";
import { ALLOW_USER_REGISTRATION } from "@/lib/auth/env";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Better Auth API route handler with registration checks
 *
 * Wraps Better Auth handlers to enforce:
 * - ALLOW_USER_REGISTRATION flag for OAuth/OIDC sign-ups
 * - Existing users can still sign in via OAuth even when registration is disabled
 */

const handlers = toNextJsHandler(auth);

// Wrap POST handler to check registration restrictions
const originalPost = handlers.POST;

export const POST = async (req: NextRequest) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Check if this is an OAuth callback (sign-in attempt)
  // Better Auth OAuth callbacks are handled at /api/auth/callback/*
  const isOAuthCallback =
    pathname.includes("/callback/") || pathname.endsWith("/sign-in/social");

  // If OAuth callback and registration is disabled, check if user exists
  if (isOAuthCallback && !ALLOW_USER_REGISTRATION) {
    try {
      // Try to extract email from the request
      // For OAuth callbacks, the email comes from the OAuth provider
      // We'll check after Better Auth processes the OAuth response

      // Clone request to peek at body without consuming it
      const clonedReq = req.clone();
      let bodyText = "";
      try {
        bodyText = await clonedReq.text();
      } catch (e) {
        // Body might not be readable, continue
      }

      // If we can extract email from query params or body, check user existence
      let emailToCheck: string | null = null;

      // Try to parse email from body (for social sign-in POST requests)
      if (bodyText) {
        try {
          const body = JSON.parse(bodyText);
          emailToCheck = body.email || null;
        } catch (e) {
          // Not JSON or no email field
        }
      }

      // If we have an email, check if user exists
      if (emailToCheck) {
        const existingUser = await db
          .select()
          .from(userTable)
          .where(eq(userTable.email, emailToCheck))
          .limit(1);

        // Block new user registration via OAuth
        if (existingUser.length === 0) {
          return new Response(
            JSON.stringify({
              error:
                "Registration is currently disabled. Please contact an administrator.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    } catch (error) {
      console.error("Error checking registration restriction:", error);
      // Continue to Better Auth handler on errors
    }
  }

  // Call original Better Auth handler
  return originalPost(req);
};

// Export GET handler as-is
export const GET = handlers.GET;
