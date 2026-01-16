"use client";

import { useEffect, useState, useRef } from "react";
import { onlineManager } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Toast ID for persistent disconnect toast
const DISCONNECT_TOAST_ID = "connection-status-disconnected";

/**
 * Hook to track connection/polling status for React Query.
 * Shows toast notifications on status changes.
 * Returns true if the browser is online and React Query can poll.
 */
export function useConnectionStatus() {
  const t = useTranslations();
  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());
  const hasInitialized = useRef(false);
  const previousOnline = useRef(isOnline);

  useEffect(() => {
    // Subscribe to online status changes from React Query
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Show toast notifications on status changes
  useEffect(() => {
    // Skip initial render - don't show toast on page load
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      previousOnline.current = isOnline;
      return;
    }

    // Only show toast if status actually changed
    if (previousOnline.current === isOnline) {
      return;
    }

    previousOnline.current = isOnline;

    if (isOnline) {
      // Dismiss any existing disconnect toast
      toast.dismiss(DISCONNECT_TOAST_ID);
      // Show connected toast for a few seconds
      toast.success(t("sync.connected"), {
        duration: 3000,
      });
    } else {
      // Show permanent disconnect toast
      toast.error(t("sync.disconnected"), {
        id: DISCONNECT_TOAST_ID,
        duration: Infinity,
      });
    }
  }, [isOnline, t]);

  return {
    isOnline,
    isPolling: isOnline, // Polling works when online
  };
}
