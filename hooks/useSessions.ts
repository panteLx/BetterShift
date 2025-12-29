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
      // Use Better Auth's built-in listSessions
      const data = await authClient.listSessions();
      setSessions(data.data || []);
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
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchSessions,
    revokeAllSessions,
  };
}
