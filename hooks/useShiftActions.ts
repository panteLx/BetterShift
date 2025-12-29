import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { isSameDay } from "date-fns";
import { ShiftFormData } from "@/components/shift-sheet";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";

interface UseShiftActionsProps {
  shifts: ShiftWithCalendar[];
  setShifts: (shifts: ShiftWithCalendar[]) => void;
  presets: ShiftPreset[];
  createShift: (data: ShiftFormData) => Promise<ShiftWithCalendar | null>;
  updateShift: (id: string, data: ShiftFormData) => Promise<boolean>;
  deleteShift: (id: string) => Promise<boolean>;
  onStatsRefresh: () => void;
}

export function useShiftActions({
  shifts,
  setShifts,
  presets,
  createShift,
  updateShift,
  deleteShift,
  onStatsRefresh,
}: UseShiftActionsProps) {
  const t = useTranslations();
  const [togglingDates, setTogglingDates] = useState<Set<string>>(new Set());
  const togglingDatesRef = useRef(togglingDates);

  // Keep ref in sync with state
  useEffect(() => {
    togglingDatesRef.current = togglingDates;
  }, [togglingDates]);

  const handleShiftSubmit = useCallback(
    async (formData: ShiftFormData) => {
      try {
        const result = await createShift(formData);
        if (result) {
          onStatsRefresh();
        }
      } catch (error) {
        console.error("Failed to create shift:", error);
      }
    },
    [createShift, onStatsRefresh]
  );

  const handleUpdateShift = useCallback(
    async (id: string, formData: ShiftFormData) => {
      const success = await updateShift(id, formData);
      if (success) {
        onStatsRefresh();
      }
    },
    [updateShift, onStatsRefresh]
  );

  const handleDeleteShift = useCallback(
    async (id: string) => {
      const success = await deleteShift(id);
      if (success) {
        onStatsRefresh();
      }
    },
    [deleteShift, onStatsRefresh]
  );

  const handleAddShift = useCallback(
    async (date: Date, selectedPresetId: string | undefined) => {
      if (!selectedPresetId) return;

      const preset = presets.find((p) => p.id === selectedPresetId);
      if (!preset) return;

      const targetDate = new Date(date);
      const dateKey = formatDateToLocal(targetDate);

      if (togglingDatesRef.current.has(dateKey)) return;

      setTogglingDates((prev) => new Set(prev).add(dateKey));

      try {
        const existingShift = shifts.find(
          (shift) =>
            shift.date &&
            isSameDay(new Date(shift.date), targetDate) &&
            shift.title === preset.title &&
            shift.startTime === preset.startTime &&
            shift.endTime === preset.endTime
        );

        if (existingShift) {
          const previousShifts = [...shifts];
          setShifts(shifts.filter((s) => s.id !== existingShift.id));
          onStatsRefresh();

          try {
            const response = await fetch(`/api/shifts/${existingShift.id}`, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            });

            if (!response.ok) {
              setShifts(previousShifts);
              onStatsRefresh();
              toast.error(
                t("common.deleteError", { item: t("shift.shift_one") })
              );
            } else {
              toast.success(
                t("common.deleted", { item: t("shift.shift_one") })
              );
            }
          } catch (error) {
            console.error("Failed to delete shift:", error);
            setShifts(previousShifts);
            onStatsRefresh();
            toast.error(
              t("common.deleteError", { item: t("shift.shift_one") })
            );
          }
        } else {
          const shiftData: ShiftFormData = {
            date: dateKey,
            startTime: preset.startTime,
            endTime: preset.endTime,
            title: preset.title,
            color: preset.color,
            notes: preset.notes || "",
            presetId: preset.id,
            isAllDay: preset.isAllDay || false,
          };

          const newShift = await createShift(shiftData);
          if (newShift) {
            onStatsRefresh();
          }
        }
      } finally {
        setTogglingDates((prev) => {
          const next = new Set(prev);
          next.delete(dateKey);
          return next;
        });
      }
    },
    [shifts, setShifts, presets, createShift, onStatsRefresh, t]
  );

  return {
    togglingDates,
    handleShiftSubmit,
    handleUpdateShift,
    handleDeleteShift,
    handleAddShift,
  };
}
