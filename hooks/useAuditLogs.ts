import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

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
  timestamp: string;
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
  sortBy?: "timestamp" | "action" | "severity" | "user" | "ipAddress";
  sortOrder?: "asc" | "desc";
}

export interface AuditLogPagination {
  limit?: number;
  offset?: number;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Hook for managing audit logs (admin only)
 *
 * Provides functions to:
 * - Fetch audit logs with filtering, sorting, and pagination
 * - Delete logs by date range
 * - Delete specific logs by IDs
 * - Export logs (future feature)
 */
export function useAuditLogs() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetch audit logs with filters, sorting, and pagination
   */
  const fetchAuditLogs = useCallback(
    async (
      filters: AuditLogFilters = {},
      sort: AuditLogSort = {},
      pagination: AuditLogPagination = {}
    ): Promise<AuditLogsResponse | null> => {
      setIsLoading(true);

      try {
        const params = new URLSearchParams();

        // Add filters
        if (filters.action) params.append("action", filters.action);
        if (filters.userId) params.append("userId", filters.userId);
        if (filters.resourceType)
          params.append("resourceType", filters.resourceType);
        if (filters.resourceId) params.append("resourceId", filters.resourceId);
        if (filters.severity) params.append("severity", filters.severity);
        if (filters.search) params.append("search", filters.search);
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);

        // Add sorting
        if (sort.sortBy) params.append("sortBy", sort.sortBy);
        if (sort.sortOrder) params.append("sortOrder", sort.sortOrder);

        // Add pagination
        if (pagination.limit)
          params.append("limit", pagination.limit.toString());
        if (pagination.offset !== undefined)
          params.append("offset", pagination.offset.toString());

        const response = await fetch(`/api/admin/audit-logs?${params}`, {
          credentials: "include",
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to fetch audit logs");
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("[useAuditLogs] Fetch error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("admin.auditLogs.fetchError")
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Delete audit logs older than a specific date
   * (Superadmin only)
   */
  const deleteLogsByDate = useCallback(
    async (beforeDate: string): Promise<boolean> => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/admin/audit-logs?before=${encodeURIComponent(beforeDate)}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to delete audit logs");
        }

        const data = await response.json();
        toast.success(t("common.deletedCount", { count: data.deletedCount }));
        return true;
      } catch (error) {
        console.error("[useAuditLogs] Delete by date error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("admin.auditLogs.deleteError")
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Delete specific audit logs by IDs
   * (Superadmin only)
   */
  const deleteLogsByIds = useCallback(
    async (logIds: string[]): Promise<boolean> => {
      if (logIds.length === 0) {
        toast.error(t("admin.auditLogs.noLogsSelected"));
        return false;
      }

      setIsLoading(true);

      try {
        const response = await fetch("/api/admin/audit-logs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ logIds }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Failed to delete audit logs");
        }

        const data = await response.json();
        toast.success(t("common.deletedCount", { count: data.deletedCount }));
        return true;
      } catch (error) {
        console.error("[useAuditLogs] Delete by IDs error:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("admin.auditLogs.deleteError")
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  return {
    isLoading,
    fetchAuditLogs,
    deleteLogsByDate,
    deleteLogsByIds,
  };
}
