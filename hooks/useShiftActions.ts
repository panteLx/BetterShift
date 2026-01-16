import { useState, useCallback, useRef, useEffect } from "react";
import { isSameDay } from "date-fns";
import { ShiftFormData } from "@/components/shift-sheet";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";

interface UseShiftActionsProps {
  shifts: ShiftWithCalendar[];
  presets: ShiftPreset[];
  createShift: (data: ShiftFormData) => Promise<ShiftWithCalendar>;
  deleteShift: (id: string) => Promise<void>;
  onStatsRefresh?: () => void;
}

export function useShiftActions({
  shifts,
  presets,
  createShift,
  deleteShift,
}: UseShiftActionsProps) {
  const [togglingDates, setTogglingDates] = useState<Set<string>>(new Set());
  const togglingDatesRef = useRef(togglingDates);

  // Keep ref in sync with state
  useEffect(() => {
    togglingDatesRef.current = togglingDates;
  }, [togglingDates]);

  const handleShiftSubmit = useCallback(
    async (formData: ShiftFormData) => {
      try {
        await createShift(formData);
      } catch (error) {
        console.error("Failed to create shift:", error);
      }
    },
    [createShift]
  );

  const handleDeleteShift = useCallback(
    async (id: string) => {
      try {
        await deleteShift(id);
      } catch (error) {
        console.error("Failed to delete shift:", error);
      }
    },
    [deleteShift]
  );

  const handleAddShift = useCallback(
    async (date: Date | string, selectedPresetId: string | undefined) => {
      if (!selectedPresetId) return;

      const preset = presets.find((p) => p.id === selectedPresetId);
      if (!preset) return;

      const targetDate =
        typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? parseLocalDate(date)
          : new Date(date);
      const dateKey = formatDateToLocal(targetDate);

      if (togglingDatesRef.current.has(dateKey)) return;

      setTogglingDates((prev) => new Set(prev).add(dateKey));

      try {
        const existingShift = shifts.find(
          (shift) =>
            shift.date &&
            isSameDay(shift.date as Date, targetDate) &&
            shift.title === preset.title &&
            shift.startTime === preset.startTime &&
            shift.endTime === preset.endTime
        );

        if (existingShift) {
          try {
            await deleteShift(existingShift.id);
          } catch (error) {
            console.error("Failed to delete shift:", error);
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

          try {
            await createShift(shiftData);
          } catch (error) {
            console.error("Failed to create shift:", error);
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
    [shifts, presets, createShift, deleteShift]
  );

  return {
    togglingDates,
    handleShiftSubmit,
    handleDeleteShift,
    handleAddShift,
  };
}
