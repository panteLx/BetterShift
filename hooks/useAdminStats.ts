"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

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
 * Fetch admin stats from API
 */
async function fetchAdminStatsApi(
  t: ReturnType<typeof useTranslations>
): Promise<AdminStats> {
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
    data.activity.logs = data.activity.logs.map((log: AuditLogResponse) => ({
      ...log,
      timestamp: new Date(log.timestamp),
    }));
  }

  return data;
}

/**
 * Admin Statistics Hook
 *
 * Fetches and manages system-wide statistics for admin dashboard.
 * Uses React Query for automatic polling and cache management.
 *
 * Features:
 * - Automatic 5-second polling for live updates
 * - Error handling with toast notifications
 * - Smart caching and background refetching
 * - Loading state management
 *
 * @returns Object with stats data, loading state, error, and refetch function
 */
export function useAdminStats(): {
  stats: AdminStats | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const t = useTranslations();
  const lastErrorMessage = useRef<string | null>(null);

  const {
    data: stats = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: queryKeys.admin.stats,
    queryFn: () => fetchAdminStatsApi(t),
    refetchInterval: REFETCH_INTERVAL,
  });

  useEffect(() => {
    if (error && error.message !== lastErrorMessage.current) {
      toast.error(error.message);
      lastErrorMessage.current = error.message;
    } else if (!error) {
      lastErrorMessage.current = null;
    }
  }, [error]);

  return {
    stats,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
