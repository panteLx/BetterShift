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
  CUSTOM_OIDC_NAME,
  hasSocialProviders as hasSocialProvidersEnv,
  getEnabledProviders as getEnabledProvidersEnv,
  MULTI_TENANT,
} from "./env";
import { DEFAULT_WORKSPACE_ID, getRequestWorkspace } from "@/lib/workspace";
import { effectiveAllowGuestAccess, getWorkspaceSettings } from "@/lib/workspace-settings";

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
 * Server-side: Check if guest access is allowed for a workspace
 * Returns true if auth is disabled (entire system public) OR if the workspace enables guest access.
 * Pass workspaceId outside request scope (proxy, background jobs); omitted, it is read from the
 * request host via headers(), which throws there.
 */
export const allowGuestAccess = async (workspaceId?: string): Promise<boolean> => {
  // If auth is disabled, everything is public (backward compatibility)
  if (!isAuthEnabled()) return true;

  const resolvedId =
    workspaceId ??
    (MULTI_TENANT ? (await getRequestWorkspace())?.id : DEFAULT_WORKSPACE_ID);
  // Fail closed: an unresolvable workspace grants nothing
  if (!resolvedId) return false;

  return await effectiveAllowGuestAccess(await getWorkspaceSettings(resolvedId));
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
