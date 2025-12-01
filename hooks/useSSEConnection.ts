import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface SSEConnectionOptions {
  calendarId: string | undefined;
  onShiftUpdate: () => void;
  onPresetUpdate: () => void;
  onNoteUpdate: () => void;
  onStatsRefresh: () => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export function useSSEConnection({
  calendarId,
  onShiftUpdate,
  onPresetUpdate,
  onNoteUpdate,
  onStatsRefresh,
  isConnected,
  setIsConnected,
}: SSEConnectionOptions) {
  const t = useTranslations();
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const disconnectTimeRef = useRef<number | null>(null);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && calendarId) {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;

        if (timeSinceLastSync > 30000 || disconnectTimeRef.current) {
          console.log("Tab became visible, resyncing data...");
          toast.info(t("sync.refreshing"), { duration: Infinity });
          onShiftUpdate();
          onPresetUpdate();
          onNoteUpdate();
          onStatsRefresh();
          lastSyncTimeRef.current = now;
          disconnectTimeRef.current = null;
          setTimeout(() => toast.dismiss(), 1000);
        }
      }
    };

    const handleOnline = () => {
      console.log("Network connection restored");
      toast.dismiss();
      toast.success(t("sync.reconnected"));
      setIsConnected(true);
      if (calendarId) {
        onShiftUpdate();
        onPresetUpdate();
        onNoteUpdate();
        onStatsRefresh();
        lastSyncTimeRef.current = Date.now();
        disconnectTimeRef.current = null;
      }
    };

    const handleOffline = () => {
      console.log("Network connection lost");
      toast.error(t("sync.offline"), { duration: Infinity });
      setIsConnected(false);
      disconnectTimeRef.current = Date.now();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [calendarId, t]);

  // Setup SSE connection
  useEffect(() => {
    if (!calendarId) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(
      `/api/events/stream?calendarId=${calendarId}`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
      toast.dismiss();

      if (disconnectTimeRef.current) {
        const disconnectDuration = Date.now() - disconnectTimeRef.current;
        if (disconnectDuration > 10000) {
          console.log("Reconnected after long disconnect, resyncing...");
          toast.info(t("sync.resyncing"), { duration: Infinity });
          onShiftUpdate();
          onPresetUpdate();
          onNoteUpdate();
          onStatsRefresh();
        }
        disconnectTimeRef.current = null;
      }
      lastSyncTimeRef.current = Date.now();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("SSE connected for calendar:", data.calendarId);
          return;
        }

        if (data.type === "shift") {
          onShiftUpdate();
          onStatsRefresh();
        } else if (data.type === "preset") {
          onPresetUpdate();
        } else if (data.type === "note") {
          onNoteUpdate();
        }

        lastSyncTimeRef.current = Date.now();
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      setIsConnected(false);
      disconnectTimeRef.current = Date.now();
      eventSource.close();

      const errorTimeout = setTimeout(() => {
        if (!navigator.onLine) {
          toast.error(t("sync.disconnected"), { duration: Infinity });
        }
      }, 5000);

      setTimeout(() => {
        clearTimeout(errorTimeout);
        if (calendarId && navigator.onLine) {
          console.log("Attempting to reconnect and resync...");
          onShiftUpdate();
          onPresetUpdate();
          onNoteUpdate();
        }
      }, 3000);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
    };
  }, [calendarId]);

  return {
    lastSyncTimeRef,
    disconnectTimeRef,
  };
}
