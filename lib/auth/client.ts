"use client";

import { createAuthClient } from "better-auth/react";
import { genericOAuthClient, adminClient } from "better-auth/client/plugins";
import { ac, roles } from "@/lib/auth/access-control";

/**
 * Better Auth client for client-side authentication
 *
 * Provides methods for:
 * - Sign in with email/password
 * - Sign in with social providers (Google, GitHub, Discord)
 * - Sign in with custom OIDC provider
 * - Sign out
 * - User session management
 * - Registration
 *
 * IMPORTANT: baseURL should match the current origin to ensure cookies are sent.
 * We use window.location.origin as fallback if __PUBLIC_CONFIG__ is not available.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.__PUBLIC_CONFIG__?.auth?.url || window.location.origin
      : "",
  plugins: [
    genericOAuthClient(),
    adminClient({
      ac,
      roles,
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
