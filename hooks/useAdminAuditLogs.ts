"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

/**
 * Audit Log Types
 */
export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  severity: "info" | "warning" | "error" | "critical";
  isUserVisible: boolean;
  timestamp: Date;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: "info" | "warning" | "error" | "critical";
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogSort {
  field: "timestamp" | "action" | "severity" | "user" | "ipAddress";
  direction: "asc" | "desc";
}

export interface AuditLogPagination {
  limit: number;
  offset: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Fetch audit logs from API
 */
async function fetchAuditLogsApi(
  filters: AuditLogFilters,
  sort: AuditLogSort,
  pagination: AuditLogPagination,
  t: ReturnType<typeof useTranslations>
): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();

  if (filters.action) params.set("action", filters.action);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.resourceId) params.set("resourceId", filters.resourceId);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.search) params.set("search", filters.search);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);

  params.set("sortBy", sort.field);
  params.set("sortOrder", sort.direction);
  params.set("limit", pagination.limit.toString());
  params.set("offset", pagination.offset.toString());

  const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(t("admin.accessDenied"));
    }
    throw new Error(t("common.fetchError", { item: t("admin.auditLogs") }));
  }

  const data = await response.json();

  // Parse date strings to Date objects
  const logs = data.logs.map((log: Record<string, unknown>) => ({
    ...log,
    timestamp: new Date(log.timestamp as string),
  }));

  return {
    logs,
    total: data.pagination.total,
    limit: data.pagination.limit,
    offset: data.pagination.offset,
  };
}

/**
 * Delete audit logs by IDs via API
 */
async function deleteLogsByIdsApi(
  logIds: string[],
  t: ReturnType<typeof useTranslations>
): Promise<{ deletedCount: number }> {
  const response = await fetch("/api/admin/audit-logs", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logIds }),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(t("admin.accessDenied"));
    }
    throw new Error(t("common.deleteError", { item: t("admin.auditLogs") }));
  }

  return await response.json();
}

/**
 * Delete audit logs by date via API
 */
async function deleteLogsByDateApi(
  beforeDate: string,
  t: ReturnType<typeof useTranslations>
): Promise<{ deletedCount: number }> {
  const response = await fetch(
    `/api/admin/audit-logs?before=${encodeURIComponent(beforeDate)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(t("admin.accessDenied"));
    }
    throw new Error(t("common.deleteError", { item: t("admin.auditLogs") }));
  }

  return await response.json();
}

/**
 * Admin Audit Logs Hook
 *
 * Provides functions for managing audit logs in the admin panel.
 * Uses React Query for automatic polling and cache management.
 *
 * Features:
 * - Fetch audit logs with filtering, sorting, and pagination
 * - Delete audit logs by IDs (superadmin only)
 * - Delete audit logs by date (superadmin only)
 * - Optimistic updates for instant UI feedback
 * - Error handling with toast notifications
 * - Automatic cache invalidation
 *
 * @param filters - Audit log filters
 * @param sort - Sort options (field, direction)
 * @param pagination - Pagination options (limit, offset)
 * @returns Object with audit log data and management functions
 */
export function useAdminAuditLogs(
  filters: AuditLogFilters = {},
  sort: AuditLogSort = { field: "timestamp", direction: "desc" },
  pagination: AuditLogPagination = { limit: 25, offset: 0 }
) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch audit logs list with polling
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: queryKeys.admin.auditLogs({ filters, sort, pagination }),
    queryFn: () => fetchAuditLogsApi(filters, sort, pagination, t),
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Delete audit logs by IDs mutation
  const deleteByIdsMutation = useMutation({
    mutationFn: (logIds: string[]) => deleteLogsByIdsApi(logIds, t),
    onMutate: async (logIds) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.auditLogs({ filters, sort, pagination }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.auditLogs({ filters, sort, pagination })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.auditLogs({ filters, sort, pagination }),
        (old: AuditLogsResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            logs: old.logs.filter((log) => !logIds.includes(log.id)),
            total: old.total - logIds.length,
          };
        }
      );

      return { previous };
    },
    onError: (err, logIds, context) => {
      queryClient.setQueryData(
        queryKeys.admin.auditLogs({ filters, sort, pagination }),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.deleteError", { item: t("admin.auditLogs") })
      );
    },
    onSuccess: (data) => {
      toast.success(t("common.deletedCount", { count: data.deletedCount }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Delete audit logs by date mutation
  const deleteByDateMutation = useMutation({
    mutationFn: (beforeDate: string) => deleteLogsByDateApi(beforeDate, t),
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.deleteError", { item: t("admin.auditLogs") })
      );
    },
    onSuccess: (data) => {
      toast.success(t("common.deletedCount", { count: data.deletedCount }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
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
    deleteLogsByIds: async (logIds: string[]): Promise<boolean> => {
      if (logIds.length === 0) {
        return false;
      }
      try {
        await deleteByIdsMutation.mutateAsync(logIds);
        return true;
      } catch {
        return false;
      }
    },
    deleteLogsByDate: async (beforeDate: string): Promise<boolean> => {
      try {
        await deleteByDateMutation.mutateAsync(beforeDate);
        return true;
      } catch {
        return false;
      }
    },
    fetchAuditLogs: async (
      searchFilters: AuditLogFilters,
      searchSort: AuditLogSort,
      searchPagination: AuditLogPagination
    ): Promise<AuditLogsResponse | null> => {
      try {
        return await fetchAuditLogsApi(
          searchFilters,
          searchSort,
          searchPagination,
          t
        );
      } catch {
        return null;
      }
    },
  };
}
