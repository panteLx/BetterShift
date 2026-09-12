"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isSameDay, isSameMonth } from "date-fns";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CalendarWithCount } from "@/lib/types";
import { useCompareData } from "@/hooks/useCompareData";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";

function toDate(date: Date | string): Date {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? parseLocalDate(date)
    : new Date(date);
}

interface UseCompareModeProps {
  calendars: CalendarWithCount[];
  hasLoadedOnce: boolean;
  selectedCalendar: string | undefined;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectDay: (day: Date) => void;
  selectedPresetId: string | undefined;
}

export function useCompareMode({
  calendars,
  hasLoadedOnce,
  selectedCalendar,
  currentDate,
  setCurrentDate,
  selectDay,
  selectedPresetId,
}: UseCompareModeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showCompareSelector, setShowCompareSelector] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  // Selection before the picker opened, restored on cancel
  const [compareSnapshot, setCompareSnapshot] = useState<string[]>([]);
  const [compareTogglingDates, setCompareTogglingDates] = useState<
    Map<string, Set<string>>
  >(new Map());
  const [compareNoteCalendarId, setCompareNoteCalendarId] = useState<
    string | undefined
  >();

  const compareData = useCompareData({
    calendarIds: selectedCompareIds,
    enabled: isCompareMode,
  });

  // Load compare mode from URL on initial load
  useEffect(() => {
    const compareParam = searchParams.get("compare");
    if (compareParam && !isCompareMode) {
      const calendarIds = compareParam.split(",").filter((id) => id.trim());
      if (calendarIds.length >= 2 && calendarIds.length <= 3) {
        const validIds = calendarIds.filter((id) =>
          calendars.some((cal) => cal.id === id)
        );
        if (validIds.length >= 2) {
          // Syncing from the URL (an external source), not from render state.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedCompareIds(validIds);
          setIsCompareMode(true);
        }
      }
    } else if (!compareParam && isCompareMode) {
      setIsCompareMode(false);
      setSelectedCompareIds([]);
      setCompareTogglingDates(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, calendars]);

  // The effect above only filters while entering compare mode. Access to one of
  // the columns can be lost afterwards, and compare needs at least two.
  useEffect(() => {
    if (!isCompareMode || !hasLoadedOnce) return;
    const stillAccessible = selectedCompareIds.filter((id) =>
      calendars.some((cal) => cal.id === id)
    );
    if (stillAccessible.length === selectedCompareIds.length) return;
    queueMicrotask(() => {
      if (stillAccessible.length >= 2) {
        setSelectedCompareIds(stillAccessible);
      } else {
        setIsCompareMode(false);
        setSelectedCompareIds([]);
        setCompareTogglingDates(new Map());
      }
    });
  }, [isCompareMode, hasLoadedOnce, calendars, selectedCompareIds]);

  const handleToggleCompareCalendar = useCallback((calendarId: string) => {
    setSelectedCompareIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  }, []);

  const handleExitCompare = useCallback(() => {
    setIsCompareMode(false);
    setSelectedCompareIds([]);
    setCompareTogglingDates(new Map());
    router.replace(selectedCalendar ? `/?id=${selectedCalendar}` : `/`, {
      scroll: false,
    });
  }, [router, selectedCalendar]);

  const updateCompareToggling = useCallback(
    (calendarId: string, dateKey: string, add: boolean) => {
      setCompareTogglingDates((prev) => {
        const updated = new Map(prev);
        const next = new Set(updated.get(calendarId) || []);
        if (add) next.add(dateKey);
        else next.delete(dateKey);
        updated.set(calendarId, next);
        return updated;
      });
    },
    []
  );

  const openComparePicker = useCallback(() => {
    setCompareSnapshot(isCompareMode ? selectedCompareIds : []);
    setShowCompareSelector(true);
  }, [isCompareMode, selectedCompareIds]);

  const handleCompareDayClick = useCallback(
    async (calendarId: string, date: Date | string) => {
      const targetDate = toDate(date);
      selectDay(targetDate);
      if (!isSameMonth(targetDate, currentDate)) setCurrentDate(targetDate);
      if (!selectedPresetId) return;

      const calendarPresets = compareData.presetsMap.get(calendarId) || [];
      const calendarShifts = compareData.shiftsMap.get(calendarId) || [];
      const preset = calendarPresets.find((p) => p.id === selectedPresetId);
      if (!preset) return;

      const dateKey = formatDateToLocal(targetDate);
      if (compareTogglingDates.get(calendarId)?.has(dateKey)) return;
      updateCompareToggling(calendarId, dateKey, true);

      try {
        const existingShift = calendarShifts.find(
          (shift) =>
            shift.date &&
            isSameDay(shift.date as Date, targetDate) &&
            shift.title === preset.title &&
            shift.startTime === preset.startTime &&
            shift.endTime === preset.endTime
        );

        if (existingShift) {
          await compareData.deleteShift({ calendarId, shiftId: existingShift.id });
        } else {
          await compareData.createShift({
            calendarId,
            formData: {
              date: dateKey,
              startTime: preset.startTime,
              endTime: preset.endTime,
              title: preset.title,
              color: preset.color,
              notes: preset.notes || "",
              presetId: preset.id,
              isAllDay: preset.isAllDay || false,
            },
          });
        }
      } catch (error) {
        console.error("Failed to toggle shift:", error);
        toast.error(t("common.error"));
      } finally {
        updateCompareToggling(calendarId, dateKey, false);
      }
    },
    [
      selectDay,
      currentDate,
      setCurrentDate,
      selectedPresetId,
      compareData,
      compareTogglingDates,
      updateCompareToggling,
      t,
    ]
  );

  return {
    isCompareMode,
    setIsCompareMode,
    showCompareSelector,
    setShowCompareSelector,
    selectedCompareIds,
    setSelectedCompareIds,
    compareSnapshot,
    compareTogglingDates,
    compareNoteCalendarId,
    setCompareNoteCalendarId,
    compareData,
    handleToggleCompareCalendar,
    handleExitCompare,
    openComparePicker,
    handleCompareDayClick,
  };
}
