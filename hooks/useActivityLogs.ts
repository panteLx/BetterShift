"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

// Unified activity log format (matches API response)
export interface UnifiedActivityLog {
  id: string;
  type: "sync" | "auth" | "calendar" | "security";
  action: string;
  timestamp: Date;
  severity: string;
  metadata: object | null;
  resourceType?: string;
  resourceId?: string;
}

interface ActivityLogsFilters {
  type?: "sync" | "auth" | "calendar" | "security";
  startDate?: Date;
  endDate?: Date;
  severity?: "info" | "warning" | "error" | "critical";
  search?: string;
}

interface ActivityLogsResponse {
  logs: UnifiedActivityLog[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<UnifiedActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<UnifiedActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(50); // Fixed page size
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<ActivityLogsFilters>({});

  // Fetch logs from API
  const fetchLogs = useCallback(
    async (pageNum = 0) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.type) params.set("type", filters.type);
        if (filters.startDate)
          params.set("startDate", filters.startDate.toISOString());
        if (filters.endDate)
          params.set("endDate", filters.endDate.toISOString());
        params.set("page", pageNum.toString());
        params.set("limit", limit.toString());

        const response = await fetch(`/api/activity-logs?${params}`);

        if (!response.ok) {
          throw new Error("Failed to fetch activity logs");
        }

        const data: ActivityLogsResponse = await response.json();

        // Parse timestamps
        const parsedLogs = data.logs.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));

        // Apply client-side filters (severity, search)
        let filtered = parsedLogs;

        if (filters.severity) {
          filtered = filtered.filter(
            (log) => log.severity === filters.severity
          );
        }

        if (filters.search && filters.search.trim()) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(
            (log) =>
              log.action.toLowerCase().includes(searchLower) ||
              (log.resourceType &&
                log.resourceType.toLowerCase().includes(searchLower)) ||
              (log.resourceId &&
                log.resourceId.toLowerCase().includes(searchLower))
          );
        }

        setLogs(parsedLogs);
        setFilteredLogs(filtered);
        setTotal(data.total);
        setPage(pageNum);
        setHasMore(data.hasMore);
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch activity logs"
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, limit]
  );

  // Clear all logs
  const clearLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/activity-logs", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear activity logs");
      }

      toast.success("Activity logs cleared");
      await fetchLogs(0); // Refresh logs
    } catch (err) {
      console.error("Error clearing logs:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to clear activity logs"
      );
    }
  }, [fetchLogs]);

  // Mark specific logs as read
  // Update filters
  const updateFilters = useCallback(
    (newFilters: Partial<ActivityLogsFilters>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setPage(0); // Reset to first page when filters change
    },
    []
  );

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  // Pagination
  const goToNextPage = useCallback(() => {
    if (hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore]);

  const goToPreviousPage = useCallback(() => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  }, [page]);

  // Initial fetch + fetch on filter/page change
  useEffect(() => {
    fetchLogs(page);
  }, [page, filters.type, filters.startDate, filters.endDate, fetchLogs]); // Re-fetch on server-side filter changes

  // Apply client-side filters when they change
  useEffect(() => {
    let filtered = logs;

    if (filters.severity) {
      filtered = filtered.filter((log) => log.severity === filters.severity);
    }

    if (filters.search && filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.action.toLowerCase().includes(searchLower) ||
          (log.resourceType &&
            log.resourceType.toLowerCase().includes(searchLower)) ||
          (log.resourceId && log.resourceId.toLowerCase().includes(searchLower))
      );
    }

    setFilteredLogs(filtered);
  }, [logs, filters.severity, filters.search]);

  return {
    // Data
    logs: filteredLogs,
    total,
    page,
    limit,
    hasMore,
    loading,
    error,

    // Filters
    filters,
    updateFilters,
    clearFilters,

    // Actions
    fetchLogs: () => fetchLogs(page),
    clearLogs,

    // Pagination
    goToNextPage,
    goToPreviousPage,
  };
}
