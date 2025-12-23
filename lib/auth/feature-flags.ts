/**
 * Feature flags for authentication system
 *
 * Controls whether the auth system is enabled or disabled.
 * When disabled, the app operates in single-user mode (backwards compatible).
 *
 * NOTE: Uses NEXT_PUBLIC_ env vars for client-side access.
 */

export const isAuthEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
};

export const allowUserRegistration = (): boolean => {
  if (!isAuthEnabled()) return false;
  return process.env.NEXT_PUBLIC_ALLOW_USER_REGISTRATION !== "false"; // Default: true
};

export const requireEmailVerification = (): boolean => {
  if (!isAuthEnabled()) return false;
  return process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";
};

/**
 * Check if any social providers are configured
 */
export const hasSocialProviders = (): boolean => {
  return !!(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ||
    process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ||
    (process.env.NEXT_PUBLIC_CUSTOM_OIDC_ENABLED === "true" &&
      process.env.NEXT_PUBLIC_CUSTOM_OIDC_CLIENT_ID)
  );
};

/**
 * Get list of enabled social providers
 */
export const getEnabledProviders = (): string[] => {
  const providers: string[] = [];

  if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) providers.push("google");
  if (process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) providers.push("github");
  if (process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID) providers.push("discord");
  if (
    process.env.NEXT_PUBLIC_CUSTOM_OIDC_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_CUSTOM_OIDC_CLIENT_ID
  ) {
    providers.push("custom-oidc");
  }

  return providers;
};

/**
 * Get display name for custom OIDC provider
 */
export const getCustomOIDCName = (): string => {
  return process.env.CUSTOM_OIDC_NAME || "Custom SSO";
};
