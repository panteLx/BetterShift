import { useState, useEffect, useCallback, useRef } from "react";
import { CalendarWithCount } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

export function useCalendars(initialCalendarId?: string | null) {
  const t = useTranslations();
  const [calendars, setCalendars] = useState<CalendarWithCount[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<
    string | undefined
  >();
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Capture initialCalendarId on mount to prevent dependency changes
  const initialCalendarIdRef = useRef(initialCalendarId);

  const fetchCalendars = useCallback(async () => {
    try {
      const response = await fetch("/api/calendars");
      const data = await response.json();

      // Ensure data is an array
      const calendarsData = Array.isArray(data) ? data : [];
      setCalendars(calendarsData);
      setHasLoadedOnce(true);

      // Only auto-select on initial load
      setSelectedCalendar((current) => {
        // If a calendar is already selected and still exists, keep it
        if (
          current &&
          calendarsData.some((cal: CalendarWithCount) => cal.id === current)
        ) {
          return current;
        }
        // Otherwise, try initialCalendarId or fallback to first calendar
        if (
          initialCalendarIdRef.current &&
          calendarsData.some(
            (cal: CalendarWithCount) => cal.id === initialCalendarIdRef.current
          )
        ) {
          return initialCalendarIdRef.current;
        } else if (calendarsData.length > 0) {
          return calendarsData[0].id;
        }
        return undefined;
      });
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
      setCalendars([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCalendar = async (name: string, color: string) => {
    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          guestPermission: "none", // Always default to "none" on creation
        }),
      });

      if (isRateLimitError(response)) {
        await handleRateLimitError(response, t);
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to create calendar: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.createError", { item: t("calendar.title") }));
        return;
      }

      const newCalendar = await response.json();
      setCalendars((prev) => [...prev, newCalendar]);
      setSelectedCalendar(newCalendar.id);

      toast.success(t("common.created", { item: t("calendar.title") }));
    } catch (error) {
      console.error("Failed to create calendar:", error);
      toast.error(t("common.createError", { item: t("calendar.title") }));
    }
  };

  const updateCalendar = async (
    calendarId: string,
    updates: {
      name?: string;
      color?: string;
      guestPermission?: "none" | "read" | "write";
    }
  ) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error ||
          t("common.updateError", { item: t("calendar.title") });
        toast.error(errorMessage);
        return { success: false, error: "failed" as const };
      }

      const updatedCalendar = await response.json();

      // Update local state
      setCalendars((prev) =>
        prev.map((cal) => (cal.id === calendarId ? updatedCalendar : cal))
      );

      toast.success(t("common.updated", { item: t("calendar.title") }));
      return { success: true };
    } catch (error) {
      console.error("Failed to update calendar:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.updateError", { item: t("calendar.title") })
      );
      return { success: false, error: "failed" as const };
    }
  };

  const deleteCalendar = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setCalendars((prev) => {
          const remainingCalendars = prev.filter((c) => c.id !== calendarId);

          if (selectedCalendar === calendarId) {
            setSelectedCalendar(
              remainingCalendars.length > 0
                ? remainingCalendars[0].id
                : undefined
            );
          }

          return remainingCalendars;
        });

        toast.success(t("common.deleted", { item: t("calendar.title") }));
        return true;
      } else {
        const errorText = await response.text();
        console.error(
          `Failed to delete calendar: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.deleteError", { item: t("calendar.title") }));
        return false;
      }
    } catch (error) {
      console.error("Failed to delete calendar:", error);
      toast.error(t("common.deleteError", { item: t("calendar.title") }));
    }
    return false;
  };

  // Initial calendar fetch
  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  // Listen for calendar subscription changes (SSE events + custom events)
  useEffect(() => {
    const handleCalendarChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, action } = customEvent.detail || {};

      // Refetch calendars when subscriptions change
      if (type === "calendar" && (action === "update" || action === "delete")) {
        fetchCalendars();
      }
    };

    const handleCalendarListChange = () => {
      // Triggered by calendar subscription/dismissal actions
      fetchCalendars();
    };

    // Listen to SSE calendar-change events
    window.addEventListener("calendar-change" as never, handleCalendarChange);
    // Listen to direct calendar list changes (subscriptions/dismissals)
    window.addEventListener(
      "calendar-list-change" as never,
      handleCalendarListChange
    );

    return () => {
      window.removeEventListener(
        "calendar-change" as never,
        handleCalendarChange
      );
      window.removeEventListener(
        "calendar-list-change" as never,
        handleCalendarListChange
      );
    };
  }, [fetchCalendars]);

  return {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    hasLoadedOnce,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    refetchCalendars: fetchCalendars,
  };
}
