"use client";

import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";
import { BETTER_AUTH_URL } from "./env";

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
    BETTER_AUTH_URL ||
    (typeof window !== "undefined" ? window.location.origin : ""),
  plugins: [genericOAuthClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
