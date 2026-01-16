"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalSync, SyncLog } from "@/lib/db/schema";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

/**
 * Fetch external syncs from API
 */
async function fetchExternalSyncsApi(
  calendarId: string
): Promise<ExternalSync[]> {
  const params = new URLSearchParams({ calendarId });
  const response = await fetch(`/api/external-syncs?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch external syncs");
  }

  return await response.json();
}

/**
 * Fetch sync logs from API
 */
async function fetchSyncLogsApi(calendarId: string): Promise<SyncLog[]> {
  const params = new URLSearchParams({
    calendarId,
    limit: "50",
  });

  const response = await fetch(`/api/sync-logs?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch sync logs");
  }

  return await response.json();
}

/**
 * External Sync Hook
 *
 * Provides external calendar sync data with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Fetch external syncs for a calendar
 * - Monitor sync error status from logs
 * - Automatic polling every 5 seconds
 * - Manual refetch available if needed
 *
 * @param selectedCalendar - Calendar ID to fetch syncs for
 * @returns Object with syncs data, error status, and loading state
 */
export function useExternalSync(selectedCalendar: string | null) {
  const queryClient = useQueryClient();

  // Fetch external syncs
  const { data: externalSyncs = [], isLoading: syncsLoading } = useQuery({
    queryKey: queryKeys.externalSyncs.byCalendar(selectedCalendar!),
    queryFn: () => fetchExternalSyncsApi(selectedCalendar!),
    enabled: !!selectedCalendar,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Fetch sync logs
  const { data: syncLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: queryKeys.externalSyncs.logs(selectedCalendar!),
    queryFn: () => fetchSyncLogsApi(selectedCalendar!),
    enabled: !!selectedCalendar,
    refetchInterval: REFETCH_INTERVAL,
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Compute error status from logs
  const hasSyncErrors = useMemo(
    () => syncLogs.some((log) => log.status === "error" && !log.isRead),
    [syncLogs]
  );

  // Combined refetch function
  const refetch = () => {
    if (selectedCalendar) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalSyncs.byCalendar(selectedCalendar),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.externalSyncs.logs(selectedCalendar),
      });
    }
  };

  return {
    externalSyncs,
    hasSyncErrors,
    loading: syncsLoading || logsLoading,
    refetch,
  };
}
