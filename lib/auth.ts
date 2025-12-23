import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),

  // Email and Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  },

  // Built-in social providers
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

  // Generic OAuth plugin for Custom OIDC
  plugins: [
    genericOAuth({
      config: [
        // Custom OIDC Provider
        ...(process.env.CUSTOM_OIDC_ENABLED === "true" &&
        process.env.CUSTOM_OIDC_CLIENT_ID
          ? [
              {
                providerId: "custom-oidc",
                clientId: process.env.CUSTOM_OIDC_CLIENT_ID,
                clientSecret: process.env.CUSTOM_OIDC_CLIENT_SECRET!,
                discoveryUrl: process.env.CUSTOM_OIDC_ISSUER!,
                scopes: process.env.CUSTOM_OIDC_SCOPES?.split(" ") || [
                  "openid",
                  "profile",
                  "email",
                ],
              },
            ]
          : []),
      ],
    }),
  ],

  // Session configuration
  session: {
    expiresIn: parseInt(process.env.SESSION_MAX_AGE || "604800"), // 7 days
    updateAge: parseInt(process.env.SESSION_UPDATE_AGE || "86400"), // 1 day
  },

  // Advanced settings
  advanced: {
    // Enable experimental joins for better performance
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  // User registration settings
  user: {
    // Disable sign-up if configured
    changeEmail: {
      enabled: true,
    },
  },

  // Trust host for deployment
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") || [],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
