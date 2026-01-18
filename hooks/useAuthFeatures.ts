/**
 * Client-side auth feature flags hook
 *
 * This hook provides client components with access to auth-related feature flags
 * from the public configuration.
 *
 * Usage:
 * ```tsx
 * const { isAuthEnabled, allowRegistration, allowGuest, providers } = useAuthFeatures();
 * ```
 */

import { usePublicConfig } from "./usePublicConfig";

export interface AuthFeatures {
  /**
   * Whether authentication system is enabled
   */
  isAuthEnabled: boolean;

  /**
   * Allowed registration mode
   */
  registrationMode: "open" | "whitelist" | "closed";

  /**
   * Whether new user registration is allowed (computed from mode)
   */
  allowRegistration: boolean;

  /**
   * Whether guest access (unauthenticated) is allowed
   */
  allowGuest: boolean;

  /**
   * OAuth providers configuration
   */
  providers: {
    google: string | undefined;
    github: string | undefined;
    discord: string | undefined;
    hasAny: boolean;
  };

  /**
   * Custom OIDC configuration
   */
  oidc: {
    enabled: boolean;
    name: string;
    clientId: string | undefined;
    issuer: string | undefined;
  };
}

/**
 * Hook to access auth-related feature flags in client components
 */
export function useAuthFeatures(): AuthFeatures {
  const { auth, oauth, oidc } = usePublicConfig();

  const registrationMode = auth.registrationMode || "open";
  /*
   * Allow registration if:
   * 1. Auth is enabled
   * 2. Registration mode is NOT closed
   * (We ignore auth.allowRegistration env var here because registrationMode encompasses it)
   */
  const allowRegistration = auth.enabled && registrationMode !== "closed";

  return {
    isAuthEnabled: auth.enabled,
    registrationMode,
    allowRegistration,
    allowGuest: !auth.enabled || auth.allowGuestAccess,
    providers: {
      google: oauth.google,
      github: oauth.github,
      discord: oauth.discord,
      hasAny: !!(oauth.google || oauth.github || oauth.discord),
    },
    oidc: {
      enabled: oidc.enabled,
      name: oidc.name,
      clientId: oidc.clientId,
      issuer: oidc.issuer,
    },
  };
}
