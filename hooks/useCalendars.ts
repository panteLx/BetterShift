import { useState, useEffect, useCallback, useRef } from "react";
import { CalendarWithCount } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { removeCachedPassword, setCachedPassword } from "@/lib/password-cache";

export function useCalendars(initialCalendarId?: string | null) {
  const t = useTranslations();
  const [calendars, setCalendars] = useState<CalendarWithCount[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<
    string | undefined
  >();
  const [loading, setLoading] = useState(true);

  // Capture initialCalendarId on mount to prevent dependency changes
  const initialCalendarIdRef = useRef(initialCalendarId);

  const fetchCalendars = useCallback(async () => {
    try {
      const response = await fetch("/api/calendars");
      const data = await response.json();
      setCalendars(data);

      // Only auto-select on initial load
      setSelectedCalendar((current) => {
        // If a calendar is already selected and still exists, keep it
        if (
          current &&
          data.some((cal: CalendarWithCount) => cal.id === current)
        ) {
          return current;
        }
        // Otherwise, try initialCalendarId or fallback to first calendar
        if (
          initialCalendarIdRef.current &&
          data.some(
            (cal: CalendarWithCount) => cal.id === initialCalendarIdRef.current
          )
        ) {
          return initialCalendarIdRef.current;
        } else if (data.length > 0) {
          return data[0].id;
        }
        return undefined;
      });
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createCalendar = async (
    name: string,
    color: string,
    password?: string,
    isLocked?: boolean
  ) => {
    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color,
          password,
          isLocked: isLocked || false,
        }),
      });

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

      // Cache the password if one was provided
      if (password) {
        setCachedPassword(newCalendar.id, password);
      }

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
      currentPassword?: string;
      isLocked: boolean;
      password?: string | null;
    }
  ) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.status === 401) {
        toast.error(t("validation.passwordIncorrect"));
        return { success: false, error: "unauthorized" as const };
      }

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

      // Handle password caching
      if (updates.password === null) {
        removeCachedPassword(calendarId);
      } else if (updates.password) {
        setCachedPassword(calendarId, updates.password);
      } else if (updates.currentPassword) {
        setCachedPassword(calendarId, updates.currentPassword);
      }

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

  const deleteCalendar = async (calendarId: string, password?: string) => {
    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        toast.error(t("validation.passwordIncorrect"));
        return false;
      }

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
        removeCachedPassword(calendarId);

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

  return {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    refetchCalendars: fetchCalendars,
  };
}
