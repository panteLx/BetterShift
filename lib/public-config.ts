/**
 * Public Configuration
 *
 * This module provides a centralized way to expose server-side environment
 * variables to the client safely. Only values explicitly returned by
 * getPublicConfig() are exposed to the browser.
 *
 * SECURITY: This file is server-only. Values are passed to the client via:
 * 1. SSR injection (inline script in root layout) - zero latency
 * 2. API fallback (/api/public-config) - for client-side navigation
 *
 * Usage:
 * - Server Components: import { getPublicConfig } from '@/lib/public-config'
 * - Client Components: use the usePublicConfig() hook
 */

/**
 * Returns public configuration that can be safely exposed to the client.
 * This function runs ONLY on the server and explicitly whitelists which
 * environment variables are safe to expose.
 *
 * @returns Public configuration object
 */
export function getPublicConfig() {
  return {
    // =============================================================================
    // Auth System Configuration
    // =============================================================================
    auth: {
      /**
       * Whether the authentication system is enabled
       * @default false
       */
      enabled: process.env.AUTH_ENABLED === "true",

      /**
       * Better Auth base URL for callbacks and API endpoints
       * @default "http://localhost:3000"
       */
      url: process.env.BETTER_AUTH_URL || "http://localhost:3000",

      /**
       * Allow new user registrations
       * @default true
       */
      allowRegistration: process.env.ALLOW_USER_REGISTRATION !== "false",

      /**
       * Allow unauthenticated users to view calendars with guest permission
       * @default false
       */
      allowGuestAccess: process.env.ALLOW_GUEST_ACCESS === "true",
    },

    // =============================================================================
    // OAuth Providers (Social Login)
    // =============================================================================
    oauth: {
      /**
       * Google OAuth Client ID (needed for client-side button display)
       */
      google: process.env.GOOGLE_CLIENT_ID,

      /**
       * GitHub OAuth Client ID (needed for client-side button display)
       */
      github: process.env.GITHUB_CLIENT_ID,

      /**
       * Discord OAuth Client ID (needed for client-side button display)
       */
      discord: process.env.DISCORD_CLIENT_ID,
    },

    // =============================================================================
    // Custom OIDC Provider
    // =============================================================================
    oidc: {
      /**
       * Whether custom OIDC provider is enabled
       * @default false
       */
      enabled: process.env.CUSTOM_OIDC_ENABLED === "true",

      /**
       * Custom OIDC Client ID
       */
      clientId: process.env.CUSTOM_OIDC_CLIENT_ID,

      /**
       * Display name for the OIDC provider login button
       * @default "Custom SSO"
       */
      name: process.env.CUSTOM_OIDC_NAME || "Custom SSO",

      /**
       * OIDC issuer URL (well-known configuration endpoint)
       */
      issuer: process.env.CUSTOM_OIDC_ISSUER,
    },
  } as const;
}

/**
 * Type-safe public configuration object
 */
export type PublicConfig = ReturnType<typeof getPublicConfig>;

/**
 * Validates that the public configuration is properly set up.
 * Called during build/startup to catch configuration errors early.
 */
export function validatePublicConfig(): void {
  const config = getPublicConfig();

  // Validate auth configuration
  if (config.auth.enabled && !config.auth.url) {
    console.warn(
      "[PUBLIC_CONFIG] Auth is enabled but BETTER_AUTH_URL is not set"
    );
  }

  // Validate OIDC configuration
  if (config.oidc.enabled) {
    if (!config.oidc.clientId) {
      console.warn(
        "[PUBLIC_CONFIG] OIDC is enabled but CUSTOM_OIDC_CLIENT_ID is not set"
      );
    }
    if (!config.oidc.issuer) {
      console.warn(
        "[PUBLIC_CONFIG] OIDC is enabled but CUSTOM_OIDC_ISSUER is not set"
      );
    }
  }
}
