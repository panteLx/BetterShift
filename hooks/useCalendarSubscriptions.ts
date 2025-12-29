"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type CalendarSource = "guest" | "shared";

export type AvailableCalendar = {
  id: string;
  name: string;
  color: string;
  guestPermission: string;
  permission?: string; // For shared calendars: actual share permission (owner/admin/write/read)
  owner: {
    id: string;
    name: string;
  } | null;
  isSubscribed: boolean;
  source: CalendarSource;
};

export type DismissedCalendar = {
  id: string;
  name: string;
  color: string;
  permission: string;
  owner: {
    id: string;
    name: string;
  } | null;
  source: CalendarSource;
};

type SubscriptionResponse = {
  available: AvailableCalendar[];
  dismissed: DismissedCalendar[];
};

/**
 * Hook for managing calendar subscriptions and dismissals
 */
export function useCalendarSubscriptions() {
  const t = useTranslations();
  const [availableCalendars, setAvailableCalendars] = useState<
    AvailableCalendar[]
  >([]);
  const [dismissedCalendars, setDismissedCalendars] = useState<
    DismissedCalendar[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendars = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/calendars/subscriptions");

      if (!response.ok) {
        throw new Error("Failed to fetch calendars");
      }

      const data: SubscriptionResponse = await response.json();
      setAvailableCalendars(data.available);
      setDismissedCalendars(data.dismissed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load calendars";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  /**
   * Subscribe to a public calendar or re-subscribe to a dismissed calendar
   */
  const subscribe = useCallback(
    async (calendarId: string, calendarName: string) => {
      // Find calendar in either list
      const dismissedCal = dismissedCalendars.find(
        (cal) => cal.id === calendarId
      );
      const availableCal = availableCalendars.find(
        (cal) => cal.id === calendarId
      );

      // Optimistic update: Remove from dismissed and add/update in available
      if (dismissedCal) {
        setDismissedCalendars((prev) =>
          prev.filter((cal) => cal.id !== calendarId)
        );
        setAvailableCalendars((prev) => [
          ...prev,
          {
            id: dismissedCal.id,
            name: dismissedCal.name,
            color: dismissedCal.color,
            guestPermission: dismissedCal.permission,
            permission: dismissedCal.permission, // Preserve original permission
            owner: dismissedCal.owner,
            source: dismissedCal.source,
            isSubscribed: true,
          },
        ]);
      } else if (availableCal) {
        setAvailableCalendars((prev) =>
          prev.map((cal) =>
            cal.id === calendarId ? { ...cal, isSubscribed: true } : cal
          )
        );
      }

      try {
        const response = await fetch("/api/calendars/subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ calendarId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to subscribe");
        }

        toast.success(
          t("calendar.subscriptionSuccess", { name: calendarName })
        );

        // Dispatch custom event to trigger calendar list refresh
        window.dispatchEvent(
          new CustomEvent("calendar-list-change", {
            detail: { action: "subscribe", calendarId },
          })
        );

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to subscribe";
        toast.error(message);

        // Revert optimistic update
        await fetchCalendars();
        return false;
      }
    },
    [t, fetchCalendars, dismissedCalendars, availableCalendars]
  );

  /**
   * Dismiss/Unsubscribe from a calendar
   */
  const dismiss = useCallback(
    async (calendarId: string, calendarName: string) => {
      // Find calendar in available list
      const calendar = availableCalendars.find((cal) => cal.id === calendarId);

      if (!calendar) return false;

      // Optimistic update: Remove from available and add to dismissed
      setAvailableCalendars((prev) =>
        prev.filter((cal) => cal.id !== calendarId)
      );

      setDismissedCalendars((prev) => [
        ...prev,
        {
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          permission: calendar.permission || calendar.guestPermission, // Use share permission if available, fallback to guest
          owner: calendar.owner,
          source: calendar.source,
        },
      ]);

      try {
        const response = await fetch(
          `/api/calendars/subscriptions/${calendarId}`,
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to unsubscribe");
        }

        toast.success(t("calendar.unsubscribeSuccess", { name: calendarName }));

        // Dispatch custom event to trigger calendar list refresh
        window.dispatchEvent(
          new CustomEvent("calendar-list-change", {
            detail: { action: "dismiss", calendarId },
          })
        );

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to unsubscribe";
        toast.error(message);

        // Revert optimistic update
        await fetchCalendars();
        return false;
      }
    },
    [t, fetchCalendars, availableCalendars]
  );

  return {
    availableCalendars,
    dismissedCalendars,
    loading,
    error,
    subscribe,
    dismiss,
    refetch: fetchCalendars,
  };
}
