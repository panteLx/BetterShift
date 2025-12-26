import { useState, useEffect, useCallback } from "react";
import { ExternalSync, SyncLog } from "@/lib/db/schema";

export function useExternalSync(selectedCalendar: string | null) {
  const [externalSyncs, setExternalSyncs] = useState<ExternalSync[]>([]);
  const [hasSyncErrors, setHasSyncErrors] = useState(false);
  const [syncLogRefreshTrigger, setSyncLogRefreshTrigger] = useState(0);

  const fetchExternalSyncs = useCallback(async () => {
    if (!selectedCalendar) {
      setExternalSyncs([]);
      setHasSyncErrors(false);
      return;
    }

    try {
      const params = new URLSearchParams({ calendarId: selectedCalendar });

      const response = await fetch(`/api/external-syncs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setExternalSyncs(data);
      }
    } catch (error) {
      console.error("Failed to fetch external syncs:", error);
    }
  }, [selectedCalendar]);

  const fetchSyncErrorStatus = useCallback(async () => {
    if (!selectedCalendar) {
      setHasSyncErrors(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        calendarId: selectedCalendar,
        limit: "50",
      });

      const response = await fetch(`/api/sync-logs?${params}`);
      if (response.ok) {
        const logs: SyncLog[] = await response.json();
        const hasErrors = logs.some(
          (log: SyncLog) => log.status === "error" && !log.isRead
        );
        setHasSyncErrors(hasErrors);
      }
    } catch (error) {
      console.error("Failed to fetch sync logs:", error);
    }
  }, [selectedCalendar]);

  // Fetch syncs and error status when calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      const initializeData = async () => {
        await Promise.all([fetchExternalSyncs(), fetchSyncErrorStatus()]);
      };
      initializeData();
    }
  }, [selectedCalendar, fetchExternalSyncs, fetchSyncErrorStatus]);

  return {
    externalSyncs,
    hasSyncErrors,
    syncLogRefreshTrigger,
    setSyncLogRefreshTrigger,
    fetchExternalSyncs,
    fetchSyncErrorStatus,
  };
}
