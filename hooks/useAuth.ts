"use client";

import { useSession } from "@/lib/auth/client";
import type { User } from "@/lib/auth";
import { isAuthEnabled, allowGuestAccess } from "@/lib/auth/feature-flags";

/**
 * Hook for auth state management
 *
 * Provides centralized access to:
 * - Current user
 * - Session state
 * - Loading states
 * - Authentication status
 * - Guest mode detection
 *
 * @example
 * const { user, isAuthenticated, isGuest, isLoading } = useAuth();
 *
 * if (isLoading) return <Spinner />;
 * if (isGuest) return <GuestBanner />;
 * if (!isAuthenticated) return <LoginPrompt />;
 * return <div>Welcome {user.name}</div>;
 */
export function useAuth() {
  const { data: session, isPending, error } = useSession();

  const authEnabled = isAuthEnabled();
  const guestAccessAllowed = allowGuestAccess();
  const hasUser = !!session?.user;

  // Guest: Auth enabled, no user session, but guest access allowed
  const isGuest = authEnabled && !hasUser && guestAccessAllowed;

  return {
    user: session?.user as User | undefined,
    session: session,
    isAuthenticated: hasUser,
    isGuest: isGuest,
    isLoading: isPending,
    error: error,
  };
}
