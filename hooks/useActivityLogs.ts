"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

/**
 * Activity Log Types
 */
export interface UnifiedActivityLog {
  id: string;
  type: "sync" | "auth" | "calendar" | "security";
  action: string;
  timestamp: Date;
  severity: "info" | "warning" | "error" | "critical";
  metadata: object | null;
  resourceType?: string;
  resourceId?: string;
}

export interface ActivityLogsFilters {
  type?: "sync" | "auth" | "calendar" | "security";
  startDate?: string;
  endDate?: string;
  severity?: "info" | "warning" | "error" | "critical";
  search?: string;
}

export interface ActivityLogsPagination {
  limit: number;
  offset: number;
}

export interface ActivityLogsResponse {
  logs: UnifiedActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Fetch activity logs from API
 */
async function fetchActivityLogsApi(
  filters: ActivityLogsFilters,
  pagination: ActivityLogsPagination,
  t: ReturnType<typeof useTranslations>
): Promise<ActivityLogsResponse> {
  const params = new URLSearchParams();

  if (filters.type) params.set("type", filters.type);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.search) params.set("search", filters.search);

  params.set("limit", pagination.limit.toString());
  params.set("offset", pagination.offset.toString());

  const response = await fetch(`/api/activity-logs?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(t("common.fetchError", { item: t("activityLog.title") }));
  }

  const data = await response.json();

  // Parse date strings to Date objects
  const logs = data.logs.map((log: Record<string, unknown>) => ({
    ...log,
    timestamp: new Date(log.timestamp as string),
  }));

  return {
    logs,
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  };
}

/**
 * Clear all activity logs via API
 */
async function clearLogsApi(
  t: ReturnType<typeof useTranslations>
): Promise<void> {
  const response = await fetch("/api/activity-logs", {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(t("common.deleteError", { item: t("activityLog.title") }));
  }
}

/**
 * Activity Logs Hook
 *
 * Provides user activity logs with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Fetch activity logs with filtering and pagination
 * - Clear all logs
 * - Automatic polling every 5 seconds
 * - Error handling with toast notifications
 * - Automatic cache invalidation
 *
 * @param filters - Activity log filters (pass as memoized object)
 * @param pagination - Pagination options (limit, offset) (pass as memoized object)
 * @returns Object with activity log data and management functions
 */
export function useActivityLogs(
  filters: ActivityLogsFilters = {},
  pagination: ActivityLogsPagination = { limit: 50, offset: 0 }
) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch activity logs with polling
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    /* eslint-disable-next-line @tanstack/query/exhaustive-deps */
    queryKey: queryKeys.activityLogs({ filters, pagination }),
    queryFn: () => fetchActivityLogsApi(filters, pagination, t),
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: () => clearLogsApi(t),
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("activityLog.title") }));
      queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.deleteError", { item: t("activityLog.title") })
      );
    },
  });

  return {
    // Data
    logs: logsData?.logs || [],
    total: logsData?.total || 0,
    limit: logsData?.limit || pagination.limit,
    offset: logsData?.offset || pagination.offset,
    isLoading,
    error,

    // Functions
    refetch,
    clearLogs: async (): Promise<boolean> => {
      try {
        await clearLogsMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    },
  };
}
