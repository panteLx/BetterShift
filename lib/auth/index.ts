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

// Check if auth is enabled via env var
// Note: Uses NEXT_PUBLIC_ prefix so it's available client + server side
const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

// Only initialize Better Auth if auth is enabled
export const auth = authEnabled
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
        requireEmailVerification: false,
      },
      socialProviders: {
        google: process.env.GOOGLE_CLIENT_ID
          ? {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            }
          : undefined,
        github: process.env.GITHUB_CLIENT_ID
          ? {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            }
          : undefined,
        discord: process.env.DISCORD_CLIENT_ID
          ? {
              clientId: process.env.DISCORD_CLIENT_ID,
              clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            }
          : undefined,
      },
      session: {
        expiresIn: parseInt(process.env.SESSION_MAX_AGE || "604800", 10), // 7 days default
        updateAge: parseInt(process.env.SESSION_UPDATE_AGE || "86400", 10), // 1 day default
      },
      trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS
        ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",")
        : undefined,
    })
  : // Fallback mock when auth is disabled
    ({
      handler: async () => new Response("Auth disabled", { status: 404 }),
      api: {},
    } as any);

// Export types for TypeScript
export type Session = (typeof auth)["$Infer"]["Session"];
export type User = (typeof auth)["$Infer"]["Session"]["user"];
