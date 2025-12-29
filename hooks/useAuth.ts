"use client";

import { useSession } from "@/lib/auth/client";
import type { User } from "@/lib/auth";
import { usePublicConfig } from "@/hooks/usePublicConfig";

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
  const { data: session, isPending, error, refetch } = useSession();
  const { auth } = usePublicConfig();

  const hasUser = !!session?.user;

  // Guest: Auth enabled, no user session, but guest access allowed
  const isGuest = auth.enabled && !hasUser && auth.allowGuestAccess;

  return {
    user: session?.user as User | undefined,
    session: session,
    isAuthenticated: hasUser,
    isGuest: isGuest,
    isLoading: isPending,
    error: error,
    refetch: refetch,
  };
}
