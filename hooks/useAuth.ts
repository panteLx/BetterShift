"use client";

import { useSession } from "@/lib/auth/client";
import type { User } from "@/lib/auth";

/**
 * Hook for auth state management
 *
 * Provides centralized access to:
 * - Current user
 * - Session state
 * - Loading states
 * - Authentication status
 *
 * @example
 * const { user, isAuthenticated, isLoading } = useAuth();
 *
 * if (isLoading) return <Spinner />;
 * if (!isAuthenticated) return <LoginPrompt />;
 * return <div>Welcome {user.name}</div>;
 */
export function useAuth() {
  const { data: session, isPending, error } = useSession();

  return {
    user: session?.user as User | undefined,
    session: session,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error: error,
  };
}
