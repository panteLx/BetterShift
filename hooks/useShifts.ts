import { useState, useEffect, useCallback } from "react";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormData } from "@/components/shift-sheet";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useShifts(calendarId: string | undefined) {
  const t = useTranslations();
  const [shifts, setShifts] = useState<ShiftWithCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchShifts = useCallback(
    async (showLoading = true) => {
      if (!calendarId) return;

      if (showLoading) {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams({ calendarId });

        const response = await fetch(`/api/shifts?${params}`);
        if (!response.ok) {
          setShifts([]);
          return;
        }
        const data = await response.json();
        setShifts(data);
        setHasLoadedOnce(true);
      } catch (error) {
        console.error("Failed to fetch shifts:", error);
        setShifts([]);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [calendarId]
  );

  const createShift = async (formData: ShiftFormData) => {
    if (!calendarId) return null;

    const tempId = `temp-${Date.now()}`;
    const optimisticShift: ShiftWithCalendar = {
      id: tempId,
      date: new Date(formData.date),
      startTime: formData.startTime,
      endTime: formData.endTime,
      title: formData.title,
      color: formData.color || "#000000",
      notes: formData.notes || null,
      isAllDay: formData.isAllDay || false,
      calendarId: calendarId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setShifts((prev) => [...prev, optimisticShift]);

    try {
      const response = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          calendarId: calendarId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to create shift: ${response.status} ${response.statusText}`,
          errorText
        );
        setShifts((shifts) => shifts.filter((s) => s.id !== tempId));
        toast.error(t("common.createError", { item: t("shift.shift_one") }));
        return null;
      }

      const newShift = await response.json();
      setShifts((shifts) =>
        shifts.map((s) => (s.id === tempId ? newShift : s))
      );
      toast.success(t("common.created", { item: t("shift.shift_one") }));
      return newShift;
    } catch (error) {
      console.error("Failed to create shift:", error);
      setShifts((shifts) => shifts.filter((s) => s.id !== tempId));
      toast.error(t("common.createError", { item: t("shift.shift_one") }));
      return null;
    }
  };

  const updateShift = async (id: string, formData: ShiftFormData) => {
    try {
      const response = await fetch(`/api/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to update shift: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.updateError", { item: t("shift.shift_one") }));
        return false;
      }

      const updatedShift = await response.json();
      setShifts((prev) => prev.map((s) => (s.id === id ? updatedShift : s)));
      toast.success(t("common.updated", { item: t("shift.shift_one") }));
      return true;
    } catch (error) {
      console.error("Failed to update shift:", error);
      toast.error(t("common.updateError", { item: t("shift.shift_one") }));
      return false;
    }
  };

  const deleteShift = async (id: string) => {
    try {
      const response = await fetch(`/api/shifts/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to delete shift: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.deleteError", { item: t("shift.shift_one") }));
        return false;
      }

      setShifts((prev) => prev.filter((s) => s.id !== id));
      toast.success(t("common.deleted", { item: t("shift.shift_one") }));
      return true;
    } catch (error) {
      console.error("Failed to delete shift:", error);
      toast.error(t("common.deleteError", { item: t("shift.shift_one") }));
      return false;
    }
  };

  // Fetch shifts when calendar changes

  useEffect(() => {
    if (!calendarId) {
      setShifts([]);
      return;
    }
    fetchShifts();
  }, [calendarId, fetchShifts]);

  return {
    shifts,
    setShifts,
    loading,
    hasLoadedOnce,
    createShift,
    updateShift,
    deleteShift,
    refetchShifts: () => fetchShifts(false), // Silent refresh for live updates
  };
}
