import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

interface SSEConnectionOptions {
  calendarId: string | undefined;
  onShiftUpdate: () => void;
  onPresetUpdate: () => void;
  onNoteUpdate: () => void;
  onStatsRefresh: () => void;
  onSyncLogUpdate?: () => void;
  onCalendarUpdate?: () => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export function useSSEConnection({
  calendarId,
  onShiftUpdate,
  onPresetUpdate,
  onNoteUpdate,
  onStatsRefresh,
  onSyncLogUpdate,
  onCalendarUpdate,
  setIsConnected,
}: SSEConnectionOptions) {
  const t = useTranslations();
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const disconnectTimeRef = useRef<number | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize lastSyncTimeRef on mount
  useEffect(() => {
    if (lastSyncTimeRef.current === 0) {
      lastSyncTimeRef.current = Date.now();
    }
  }, []);

  // Refs to avoid stale closures in SSE handlers
  const shiftUpdateRef = useRef(onShiftUpdate);
  const presetUpdateRef = useRef(onPresetUpdate);
  const noteUpdateRef = useRef(onNoteUpdate);
  const statsRefreshRef = useRef(onStatsRefresh);
  const syncLogUpdateRef = useRef(onSyncLogUpdate);
  const calendarUpdateRef = useRef(onCalendarUpdate);
  const setIsConnectedRef = useRef(setIsConnected);
  const tRef = useRef(t);

  // Update refs when callbacks or translations change
  useEffect(() => {
    shiftUpdateRef.current = onShiftUpdate;
    presetUpdateRef.current = onPresetUpdate;
    noteUpdateRef.current = onNoteUpdate;
    statsRefreshRef.current = onStatsRefresh;
    syncLogUpdateRef.current = onSyncLogUpdate;
    calendarUpdateRef.current = onCalendarUpdate;
    setIsConnectedRef.current = setIsConnected;
    tRef.current = t;
  }, [
    onShiftUpdate,
    onPresetUpdate,
    onNoteUpdate,
    onStatsRefresh,
    onSyncLogUpdate,
    onCalendarUpdate,
    setIsConnected,
    t,
  ]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && calendarId) {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;

        if (timeSinceLastSync > 30000 || disconnectTimeRef.current) {
          console.log("Tab became visible, resyncing data...");
          toast.info(tRef.current("sync.refreshing"), { duration: Infinity });
          shiftUpdateRef.current();
          presetUpdateRef.current();
          noteUpdateRef.current();
          statsRefreshRef.current();
          calendarUpdateRef.current?.();
          lastSyncTimeRef.current = now;
          disconnectTimeRef.current = null;
          setTimeout(() => toast.dismiss(), 1000);
        }
      }
    };

    const handleOnline = () => {
      console.log("Network connection restored");
      toast.dismiss();
      toast.success(tRef.current("sync.reconnected"));
      setIsConnectedRef.current(true);
      if (calendarId) {
        shiftUpdateRef.current();
        presetUpdateRef.current();
        noteUpdateRef.current();
        statsRefreshRef.current();
        lastSyncTimeRef.current = Date.now();
        disconnectTimeRef.current = null;
      }
    };

    const handleOffline = () => {
      console.log("Network connection lost");
      toast.error(tRef.current("sync.offline"), { duration: Infinity });
      setIsConnectedRef.current(false);
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
  }, [calendarId]);

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

    // Test connection first to check for rate limiting
    const testConnection = async () => {
      try {
        const response = await fetch(
          `/api/events/stream?calendarId=${calendarId}`,
          {
            method: "HEAD", // Just check headers, don't establish connection yet
          }
        );

        // Check for rate limit before establishing SSE connection
        if (isRateLimitError(response)) {
          await handleRateLimitError(response, t);
          setIsConnectedRef.current(false);
          return false;
        }

        return true;
      } catch {
        // If HEAD fails, try regular connection anyway
        return true;
      }
    };

    testConnection().then((canConnect) => {
      if (!canConnect) return;

      const eventSource = new EventSource(
        `/api/events/stream?calendarId=${calendarId}`
      );

      eventSource.onopen = () => {
        setIsConnectedRef.current(true);
        toast.dismiss();

        if (disconnectTimeRef.current) {
          const disconnectDuration = Date.now() - disconnectTimeRef.current;
          if (disconnectDuration > 10000) {
            console.log("Reconnected after long disconnect, resyncing...");
            toast.info(tRef.current("sync.resyncing"), { duration: Infinity });
            shiftUpdateRef.current();
            presetUpdateRef.current();
            noteUpdateRef.current();
            statsRefreshRef.current();
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
            shiftUpdateRef.current();
            statsRefreshRef.current();
          } else if (data.type === "preset") {
            presetUpdateRef.current();
          } else if (data.type === "note") {
            noteUpdateRef.current();
          } else if (data.type === "calendar") {
            calendarUpdateRef.current?.();
          } else if (data.type === "sync-log") {
            syncLogUpdateRef.current?.();
          }

          lastSyncTimeRef.current = Date.now();
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        setIsConnectedRef.current(false);
        disconnectTimeRef.current = Date.now();

        // Check if error is due to rate limiting
        // EventSource doesn't provide status codes, but we can detect it by rapid reconnection failures
        const timeSinceStart = Date.now() - lastSyncTimeRef.current;
        if (timeSinceStart < 5000) {
          // Connection failed within 5 seconds - likely rate limited
          fetch(`/api/events/stream?calendarId=${calendarId}`, {
            method: "HEAD",
          }).then(async (response) => {
            if (isRateLimitError(response)) {
              await handleRateLimitError(response, t);
              // Close the EventSource to prevent auto-reconnect
              eventSource.close();
              return;
            }
          });
        }

        // Clear any existing timeouts
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
        }
        if (resyncTimeoutRef.current) {
          clearTimeout(resyncTimeoutRef.current);
          resyncTimeoutRef.current = null;
        }

        // Show error toast after delay if offline
        errorTimeoutRef.current = setTimeout(() => {
          if (!navigator.onLine) {
            toast.error(tRef.current("sync.disconnected"), {
              duration: Infinity,
            });
          }
          errorTimeoutRef.current = null;
        }, 5000);

        // Attempt resync after delay (EventSource will auto-reconnect)
        resyncTimeoutRef.current = setTimeout(() => {
          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = null;
          }
          if (calendarId && navigator.onLine) {
            console.log("Attempting to resync data...");
            shiftUpdateRef.current();
            presetUpdateRef.current();
            noteUpdateRef.current();
          }
          resyncTimeoutRef.current = null;
        }, 3000);
      };

      eventSourceRef.current = eventSource;

      return () => {
        // Clear all timeouts on cleanup
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
          errorTimeoutRef.current = null;
        }
        if (resyncTimeoutRef.current) {
          clearTimeout(resyncTimeoutRef.current);
          resyncTimeoutRef.current = null;
        }
        // Close EventSource on unmount or calendarId change
        eventSource.close();
      };
    }); // End of testConnection().then()
  }, [calendarId, t]);

  return {
    lastSyncTimeRef,
    disconnectTimeRef,
  };
}
