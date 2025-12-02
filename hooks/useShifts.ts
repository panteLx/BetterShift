import { useState, useEffect } from "react";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormData } from "@/components/shift-dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useShifts(calendarId: string | undefined) {
  const t = useTranslations();
  const [shifts, setShifts] = useState<ShiftWithCalendar[]>([]);

  const fetchShifts = async () => {
    if (!calendarId) return;

    try {
      const response = await fetch(`/api/shifts?calendarId=${calendarId}`);
      const data = await response.json();
      setShifts(data);
    } catch (error) {
      console.error("Failed to fetch shifts:", error);
    }
  };

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
        toast.error(t("shift.createError"));
        return null;
      }

      const newShift = await response.json();
      setShifts((shifts) =>
        shifts.map((s) => (s.id === tempId ? newShift : s))
      );
      toast.success(t("shift.created"));
      return newShift;
    } catch (error) {
      console.error("Failed to create shift:", error);
      setShifts((shifts) => shifts.filter((s) => s.id !== tempId));
      toast.error(t("shift.createError"));
      return null;
    }
  };

  const updateShift = async (
    id: string,
    formData: ShiftFormData,
    onPasswordRequired?: () => void
  ) => {
    try {
      const password = calendarId
        ? localStorage.getItem(`calendar_password_${calendarId}`)
        : null;

      const response = await fetch(`/api/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, password }),
      });

      if (response.status === 401) {
        onPasswordRequired?.();
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to update shift: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("shift.updateError"));
        return false;
      }

      const updatedShift = await response.json();
      setShifts((prev) => prev.map((s) => (s.id === id ? updatedShift : s)));
      toast.success(t("shift.updated"));
      return true;
    } catch (error) {
      console.error("Failed to update shift:", error);
      toast.error(t("shift.updateError"));
      return false;
    }
  };

  const deleteShift = async (id: string, onPasswordRequired?: () => void) => {
    try {
      const password = calendarId
        ? localStorage.getItem(`calendar_password_${calendarId}`)
        : null;

      const response = await fetch(`/api/shifts/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        onPasswordRequired?.();
        return false;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to delete shift: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("shift.deleteError"));
        return false;
      }

      setShifts((prev) => prev.filter((s) => s.id !== id));
      toast.success(t("shift.deleted"));
      return true;
    } catch (error) {
      console.error("Failed to delete shift:", error);
      toast.error(t("shift.deleteError"));
      return false;
    }
  };

  useEffect(() => {
    if (calendarId) {
      fetchShifts();
    } else {
      setShifts([]);
    }
  }, [calendarId]);

  return {
    shifts,
    setShifts,
    createShift,
    updateShift,
    deleteShift,
    refetchShifts: fetchShifts,
  };
}
