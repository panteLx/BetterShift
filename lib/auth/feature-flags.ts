/**
 * Feature flags for authentication system
 *
 * Controls whether the auth system is enabled or disabled.
 * When disabled, the app operates in single-user mode (backwards compatible).
 *
 * This module re-exports commonly used auth flags from the centralized env config.
 */

import {
  AUTH_ENABLED,
  ALLOW_USER_REGISTRATION,
  ALLOW_GUEST_ACCESS,
  CUSTOM_OIDC_NAME,
  hasSocialProviders as hasSocialProvidersEnv,
  getEnabledProviders as getEnabledProvidersEnv,
} from "./env";

export const isAuthEnabled = (): boolean => {
  return AUTH_ENABLED;
};

export const allowUserRegistration = (): boolean => {
  if (!isAuthEnabled()) return false;
  return ALLOW_USER_REGISTRATION;
};

/**
 * Check if guest access is allowed
 * Returns true if auth is disabled (entire system public) OR if guest access is explicitly enabled
 */
export const allowGuestAccess = (): boolean => {
  // If auth is disabled, everything is public (backward compatibility)
  if (!isAuthEnabled()) return true;

  // If auth is enabled, check explicit guest access flag
  return ALLOW_GUEST_ACCESS;
};

/**
 * Check if any social providers are configured
 */
export const hasSocialProviders = (): boolean => {
  return hasSocialProvidersEnv();
};

/**
 * Get list of enabled social providers
 */
export const getEnabledProviders = (): string[] => {
  return getEnabledProvidersEnv();
};

/**
 * Get display name for custom OIDC provider
 */
export const getCustomOIDCName = (): string => {
  return CUSTOM_OIDC_NAME;
};
