"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Admin Stats Type Definitions
 */
export interface AdminStats {
  users: {
    superadmin: number;
    admin: number;
    user: number;
    total: number;
  };
  calendars: {
    total: number;
    orphaned: number;
  };
  shares: {
    user: number;
    token: number;
    active: number;
  };
  shifts: {
    total: number;
  };
  activity: {
    recent: number;
    logs: Array<{
      id: string;
      action: string;
      resourceType: string | null;
      resourceId: string | null;
      userId: string | null;
      severity: string;
      timestamp: Date;
    }>;
  };
}

interface AuditLogResponse {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  userId: string | null;
  severity: string;
  timestamp: string | Date;
}

/**
 * Admin Statistics Hook
 *
 * Fetches and manages system-wide statistics for admin dashboard.
 *
 * Features:
 * - Automatic data fetching on mount
 * - Optional auto-refresh (configurable interval)
 * - Error handling with toast notifications
 * - Loading state management
 *
 * @param autoRefresh - Enable auto-refresh (default: false)
 * @param refreshInterval - Refresh interval in milliseconds (default: 60000 = 1 minute)
 */
export function useAdminStats(
  autoRefresh = false,
  refreshInterval = 60000
): {
  stats: AdminStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const t = useTranslations();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch("/api/admin/stats", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t("admin.accessDenied"));
        }
        throw new Error(t("admin.statsFetchError"));
      }

      const data = await response.json();

      // Parse timestamp strings to Date objects
      if (data.activity?.logs) {
        data.activity.logs = data.activity.logs.map(
          (log: AuditLogResponse) => ({
            ...log,
            timestamp: new Date(log.timestamp),
          })
        );
      }

      setStats(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
