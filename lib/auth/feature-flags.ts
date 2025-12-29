/**
 * Feature flags for authentication system
 *
 * Controls whether the auth system is enabled or disabled.
 * When disabled, the app operates in single-user mode (backwards compatible).
 *
 * This module provides SERVER-SIDE feature flag checks.
 * For CLIENT components, use @/hooks/useAuthFeatures instead.
 */

import {
  AUTH_ENABLED,
  ALLOW_USER_REGISTRATION,
  ALLOW_GUEST_ACCESS,
  CUSTOM_OIDC_NAME,
  hasSocialProviders as hasSocialProvidersEnv,
  getEnabledProviders as getEnabledProvidersEnv,
} from "./env";

/**
 * Server-side: Check if auth system is enabled
 */
export const isAuthEnabled = (): boolean => {
  return AUTH_ENABLED;
};

/**
 * Server-side: Check if user registration is allowed
 */
export const allowUserRegistration = (): boolean => {
  if (!isAuthEnabled()) return false;
  return ALLOW_USER_REGISTRATION;
};

/**
 * Server-side: Check if guest access is allowed
 * Returns true if auth is disabled (entire system public) OR if guest access is explicitly enabled
 */
export const allowGuestAccess = (): boolean => {
  // If auth is disabled, everything is public (backward compatibility)
  if (!isAuthEnabled()) return true;

  // If auth is enabled, check explicit guest access flag
  return ALLOW_GUEST_ACCESS;
};

/**
 * Server-side: Check if any social providers are configured
 */
export const hasSocialProviders = (): boolean => {
  return hasSocialProvidersEnv();
};

/**
 * Server-side: Get list of enabled social providers
 */
export const getEnabledProviders = (): string[] => {
  return getEnabledProvidersEnv();
};

/**
 * Server-side: Get display name for custom OIDC provider
 */
export const getCustomOIDCName = (): string => {
  return CUSTOM_OIDC_NAME;
};
