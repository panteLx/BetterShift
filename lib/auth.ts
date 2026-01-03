import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { auditLogPlugin } from "@/lib/auth/audit-plugin";
import { handleFirstUserPromotion } from "@/lib/auth/first-user";
import { ac, roles } from "@/lib/auth/access-control";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  CUSTOM_OIDC_ENABLED,
  CUSTOM_OIDC_CLIENT_ID,
  CUSTOM_OIDC_CLIENT_SECRET,
  CUSTOM_OIDC_ISSUER,
  CUSTOM_OIDC_SCOPES,
  SESSION_MAX_AGE,
  SESSION_UPDATE_AGE,
  BETTER_AUTH_TRUSTED_ORIGINS,
  BETTER_AUTH_URL,
  ALLOW_USER_REGISTRATION,
} from "@/lib/auth/env";

export const auth = betterAuth({
  // Base URL configuration (critical for reverse proxy setups)
  baseURL: BETTER_AUTH_URL,
  basePath: "/api/auth",

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      ...schema,
    },
  }),

  // Email and Password authentication
  emailAndPassword: {
    disableSignUp: !ALLOW_USER_REGISTRATION,
    enabled: true,
  },

  // Built-in social providers
  socialProviders: {
    google: GOOGLE_CLIENT_ID
      ? {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET!,
        }
      : undefined,
    github: GITHUB_CLIENT_ID
      ? {
          clientId: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET!,
        }
      : undefined,
    discord: DISCORD_CLIENT_ID
      ? {
          clientId: DISCORD_CLIENT_ID,
          clientSecret: DISCORD_CLIENT_SECRET!,
        }
      : undefined,
  },

  // Generic OAuth plugin for Custom OIDC
  plugins: [
    // Audit logging plugin
    auditLogPlugin(),

    // Admin plugin for user management
    admin({
      defaultRole: "user",
      // Custom access control to support "admin" and "superadmin" roles
      // Both roles get all Better Auth admin permissions
      // Fine-grained permission control (e.g., only superadmin can ban/delete)
      // is handled by our custom checks in lib/auth/admin.ts
      ac,
      roles,
    }),

    // Custom OIDC
    genericOAuth({
      config: [
        // Custom OIDC Provider
        ...(CUSTOM_OIDC_ENABLED && CUSTOM_OIDC_CLIENT_ID
          ? [
              {
                providerId: "custom-oidc",
                clientId: CUSTOM_OIDC_CLIENT_ID,
                clientSecret: CUSTOM_OIDC_CLIENT_SECRET!,
                discoveryUrl: CUSTOM_OIDC_ISSUER!,
                scopes: CUSTOM_OIDC_SCOPES?.split(" ") || [
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
    expiresIn: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },

  // Advanced settings
  advanced: {
    // Secure cookies: Use HTTPS detection instead of just NODE_ENV
    // Better Auth will automatically add __Secure- prefix when enabled
    useSecureCookies: BETTER_AUTH_URL.startsWith("https://"),

    // Default cookie attributes (defense in depth)
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: BETTER_AUTH_URL.startsWith("https://"), // Only send over HTTPS
      httpOnly: true, // Prevent XSS attacks (already default, but explicit)
    },
  },

  // User registration settings
  user: {
    // Disable sign-up if configured
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
    },
    deleteUser: {
      enabled: true,
    },
  },

  // Database hooks for user creation control
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          // Block OAuth/OIDC registration when ALLOW_USER_REGISTRATION is false
          // This hook runs for ALL user creation attempts (email + OAuth/OIDC)
          // Email registration is already blocked by disableSignUp config
          if (!ALLOW_USER_REGISTRATION) {
            throw new Error(
              "Registration is currently disabled. Please contact an administrator."
            );
          }
          // Return void to allow creation
        },
        after: async (user) => {
          // Auto-promote first user to superadmin
          // This hook runs immediately after user creation for ALL registration methods:
          // - Email/password registration
          // - OAuth (Google, GitHub, Discord)
          // - Custom OIDC
          if (user?.id) {
            handleFirstUserPromotion(user.id).catch((error) => {
              console.error("Failed to promote first user:", error);
            });
          }
        },
      },
    },
  },

  // Trust host for deployment
  trustedOrigins: BETTER_AUTH_TRUSTED_ORIGINS,
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
