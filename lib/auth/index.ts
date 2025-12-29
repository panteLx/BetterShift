/**
 * Better Auth server configuration
 *
 * This is the main auth instance used by:
 * - API route handler (/api/auth/[...all])
 * - Server-side authentication checks
 * - Middleware
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  AUTH_ENABLED,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  SESSION_MAX_AGE,
  SESSION_UPDATE_AGE,
  BETTER_AUTH_TRUSTED_ORIGINS,
} from "./env";

// Only initialize Better Auth if auth is enabled
export const auth = AUTH_ENABLED
  ? betterAuth({
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),
      emailAndPassword: {
        enabled: true,
      },
      socialProviders: {
        google: GOOGLE_CLIENT_ID
          ? {
              clientId: GOOGLE_CLIENT_ID,
              clientSecret: GOOGLE_CLIENT_SECRET,
            }
          : undefined,
        github: GITHUB_CLIENT_ID
          ? {
              clientId: GITHUB_CLIENT_ID,
              clientSecret: GITHUB_CLIENT_SECRET,
            }
          : undefined,
        discord: DISCORD_CLIENT_ID
          ? {
              clientId: DISCORD_CLIENT_ID,
              clientSecret: DISCORD_CLIENT_SECRET,
            }
          : undefined,
      },
      session: {
        expiresIn: SESSION_MAX_AGE,
        updateAge: SESSION_UPDATE_AGE,
      },
      trustedOrigins:
        BETTER_AUTH_TRUSTED_ORIGINS.length > 0
          ? BETTER_AUTH_TRUSTED_ORIGINS
          : undefined,
    })
  : // Fallback mock when auth is disabled
    ({
      handler: async () => new Response("Auth disabled", { status: 404 }),
      api: {},
      $Infer: {} as { Session: { user: Record<string, unknown> } },
    } as {
      handler: () => Promise<Response>;
      api: Record<string, unknown>;
      $Infer: { Session: { user: Record<string, unknown> } };
    });

// Export types for TypeScript
export type Session = (typeof auth)["$Infer"]["Session"];
export type User = (typeof auth)["$Infer"]["Session"]["user"];
