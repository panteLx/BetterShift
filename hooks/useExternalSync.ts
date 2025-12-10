import { useState, useEffect, useCallback } from "react";
import { ExternalSync } from "@/lib/db/schema";
import { getCachedPassword } from "@/lib/password-cache";

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
      const password = getCachedPassword(selectedCalendar);
      const params = new URLSearchParams({ calendarId: selectedCalendar });
      if (password) {
        params.append("password", password);
      }

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
      const password = getCachedPassword(selectedCalendar);
      const params = new URLSearchParams({
        calendarId: selectedCalendar,
        limit: "50",
      });
      if (password) {
        params.append("password", password);
      }

      const response = await fetch(`/api/sync-logs?${params}`);
      if (response.ok) {
        const logs = await response.json();
        const hasErrors = logs.some(
          (log: any) => log.status === "error" && !log.isRead
        );
        setHasSyncErrors(hasErrors);
      }
    } catch (error) {
      console.error("Failed to fetch sync logs:", error);
    }
  }, [selectedCalendar]);

  useEffect(() => {
    fetchExternalSyncs();
    fetchSyncErrorStatus();
  }, [fetchExternalSyncs, fetchSyncErrorStatus]);

  return {
    externalSyncs,
    hasSyncErrors,
    syncLogRefreshTrigger,
    setSyncLogRefreshTrigger,
    fetchExternalSyncs,
    fetchSyncErrorStatus,
  };
}
