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
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined" && window.__PUBLIC_CONFIG__
      ? window.__PUBLIC_CONFIG__.auth.url
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
