import { useState, useEffect } from "react";
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

  const fetchCalendars = async () => {
    try {
      const response = await fetch("/api/calendars");
      const data = await response.json();
      setCalendars(data);

      if (
        initialCalendarId &&
        data.some((cal: CalendarWithCount) => cal.id === initialCalendarId)
      ) {
        setSelectedCalendar(initialCalendarId);
      } else if (data.length > 0 && !selectedCalendar) {
        setSelectedCalendar(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchCalendars();
  }, []);

  return {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    createCalendar,
    deleteCalendar,
    refetchCalendars: fetchCalendars,
  };
}
