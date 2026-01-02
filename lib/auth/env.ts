/**
 * Centralized environment variable configuration for authentication
 *
 * This file provides a single source of truth for all auth-related
 * environment variables, with validation and type safety.
 *
 * NOTE: For client-side access to public config values, use:
 * import { usePublicConfig } from '@/hooks/usePublicConfig'
 */

// =============================================================================
// Core Auth Settings
// =============================================================================

export const AUTH_ENABLED = process.env.AUTH_ENABLED !== "false"; // Default: true

export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "";

export const BETTER_AUTH_URL =
  process.env.BETTER_AUTH_URL || "http://localhost:3000";

// SECURITY: Always set trustedOrigins to enable CSRF protection
// Default to BETTER_AUTH_URL if not explicitly configured
export const BETTER_AUTH_TRUSTED_ORIGINS = process.env
  .BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) =>
      origin.trim()
    )
  : [BETTER_AUTH_URL]; // Default: Trust only the configured base URL

// =============================================================================
// User Registration Settings
// =============================================================================

export const ALLOW_USER_REGISTRATION =
  process.env.ALLOW_USER_REGISTRATION !== "false"; // Default: true

// =============================================================================
// Guest Access Settings
// =============================================================================

export const ALLOW_GUEST_ACCESS = process.env.ALLOW_GUEST_ACCESS === "true"; // Default: false

// =============================================================================
// Session Settings
// =============================================================================

export const SESSION_MAX_AGE = parseInt(
  process.env.SESSION_MAX_AGE || "604800",
  10
); // 7 days

export const SESSION_UPDATE_AGE = parseInt(
  process.env.SESSION_UPDATE_AGE || "86400",
  10
); // 1 day

// =============================================================================
// Google OAuth
// =============================================================================

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// =============================================================================
// GitHub OAuth
// =============================================================================

export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

// =============================================================================
// Discord OAuth
// =============================================================================

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";

// =============================================================================
// Custom OIDC Provider
// =============================================================================

export const CUSTOM_OIDC_ENABLED = process.env.CUSTOM_OIDC_ENABLED === "true";

export const CUSTOM_OIDC_NAME = process.env.CUSTOM_OIDC_NAME || "Custom SSO";

export const CUSTOM_OIDC_CLIENT_ID = process.env.CUSTOM_OIDC_CLIENT_ID || "";

export const CUSTOM_OIDC_ISSUER = process.env.CUSTOM_OIDC_ISSUER || "";

export const CUSTOM_OIDC_CLIENT_SECRET =
  process.env.CUSTOM_OIDC_CLIENT_SECRET || "";

export const CUSTOM_OIDC_SCOPES =
  process.env.CUSTOM_OIDC_SCOPES || "openid profile email";

// =============================================================================
// Computed Values & Helper Functions
// =============================================================================

/**
 * Check if any social providers are configured (server-side)
 */
export const hasSocialProviders = (): boolean => {
  return !!(
    GOOGLE_CLIENT_ID ||
    GITHUB_CLIENT_ID ||
    DISCORD_CLIENT_ID ||
    (CUSTOM_OIDC_ENABLED && CUSTOM_OIDC_CLIENT_ID)
  );
};

/**
 * Get list of enabled social providers (server-side)
 */
export const getEnabledProviders = (): string[] => {
  const providers: string[] = [];

  if (GOOGLE_CLIENT_ID) providers.push("google");
  if (GITHUB_CLIENT_ID) providers.push("github");
  if (DISCORD_CLIENT_ID) providers.push("discord");
  if (CUSTOM_OIDC_ENABLED && CUSTOM_OIDC_CLIENT_ID)
    providers.push("custom-oidc");

  return providers;
};

/**
 * Validate that required auth environment variables are set
 * (only if auth is enabled)
 */
export const validateAuthEnv = (): {
  valid: boolean;
  errors: string[];
} => {
  if (!AUTH_ENABLED) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  // Check required core settings
  if (!BETTER_AUTH_SECRET) {
    errors.push(
      "BETTER_AUTH_SECRET is required when auth is enabled. Generate with: npx @better-auth/cli secret"
    );
  }

  if (!BETTER_AUTH_URL) {
    errors.push("BETTER_AUTH_URL is required when auth is enabled");
  }

  // Check that at least one auth method is available
  const hasEmailPassword = true; // Always enabled
  const hasSocial = hasSocialProviders();

  if (!hasEmailPassword && !hasSocial) {
    errors.push(
      "At least one authentication method must be configured (email/password or social provider)"
    );
  }

  // Validate OAuth provider configuration
  if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) {
    errors.push(
      "GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set"
    );
  }

  if (GITHUB_CLIENT_ID && !GITHUB_CLIENT_SECRET) {
    errors.push(
      "GITHUB_CLIENT_SECRET is required when GITHUB_CLIENT_ID is set"
    );
  }

  if (DISCORD_CLIENT_ID && !DISCORD_CLIENT_SECRET) {
    errors.push(
      "DISCORD_CLIENT_SECRET is required when DISCORD_CLIENT_ID is set"
    );
  }

  if (CUSTOM_OIDC_ENABLED) {
    if (!CUSTOM_OIDC_ISSUER) {
      errors.push(
        "CUSTOM_OIDC_ISSUER is required when CUSTOM_OIDC_ENABLED=true"
      );
    }
    if (!CUSTOM_OIDC_CLIENT_ID) {
      errors.push(
        "CUSTOM_OIDC_CLIENT_ID is required when CUSTOM_OIDC_ENABLED=true"
      );
    }
    if (!CUSTOM_OIDC_CLIENT_SECRET) {
      errors.push(
        "CUSTOM_OIDC_CLIENT_SECRET is required when CUSTOM_OIDC_ENABLED=true"
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
