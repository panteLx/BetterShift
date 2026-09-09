import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth/client";

/**
 * Session with device information (from Better Auth listSessions)
 */
export interface SessionWithDevice {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetches the session list, without touching any component state. Shared
 * by the initial mount fetch and the manual refetch path below.
 */
async function getSessions(): Promise<SessionWithDevice[]> {
  // Use Better Auth's built-in listSessions
  const data = await authClient.listSessions();
  return data.data || [];
}

/**
 * Hook to manage user sessions using Better Auth client
 */
export function useSessions() {
  const [sessions, setSessions] = useState<SessionWithDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      setSessions(await getSessions());
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeAllSessions = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
    revokedCount?: number;
  }> => {
    try {
      // Use Better Auth's built-in revokeOtherSessions
      await authClient.revokeOtherSessions();

      // Count sessions before refresh
      const beforeCount = sessions.length - 1; // -1 for current session

      // Refresh sessions list
      await fetchSessions();

      return { success: true, revokedCount: beforeCount };
    } catch (err) {
      console.error("Error revoking all sessions:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }, [fetchSessions, sessions.length]);

  useEffect(() => {
    let cancelled = false;

    // Inlined (rather than calling `fetchSessions`) so the initial fetch
    // owns its own guard against a stale response resolving after this
    // effect has already been cleaned up.
    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getSessions();
        if (cancelled) return;
        setSessions(data);
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching sessions:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    revokeAllSessions,
  };
}
