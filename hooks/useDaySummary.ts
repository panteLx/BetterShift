"use client";

import { useMemo } from "react";
import { getDaysInMonth, getDaysInYear } from "date-fns";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { findNotesForDate } from "@/lib/event-utils";
import { getShiftMinutes, getShiftsForDay, sortShifts } from "@/lib/shift-display";
import { useShiftStats, ShiftStatsData } from "@/hooks/useShiftStats";

export type StatsPeriod = "week" | "month" | "year";

export interface ShiftTypeStat {
  title: string;
  count: number;
  color: string;
}

export interface PeriodSummary {
  stats: ShiftStatsData | null;
  freeDays: number | null;
  byType: ShiftTypeStat[];
  loading: boolean;
}

/** Everything the desktop inspector and the mobile day sheet show for one day. */
export function useDayData({
  selectedDay,
  shifts,
  notes,
}: {
  selectedDay: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
}) {
  return useMemo(() => {
    const dayShifts = sortShifts(getShiftsForDay(shifts, selectedDay), "startTime");
    const dayNotes = findNotesForDate(notes, selectedDay);
    return {
      dayShifts,
      dayNotes,
      totalMinutes: dayShifts.reduce((sum, s) => sum + getShiftMinutes(s), 0),
    };
  }, [selectedDay, shifts, notes]);
}

/** Period summary built on the existing stats endpoint. */
export function usePeriodSummary({
  calendarId,
  anchorDate,
  period,
  shifts,
}: {
  calendarId: string | undefined;
  anchorDate: Date;
  period: StatsPeriod;
  shifts: ShiftWithCalendar[];
}): PeriodSummary {
  const { stats, loading } = useShiftStats({
    calendarId,
    currentDate: anchorDate,
    period,
  });

  return useMemo(() => {
    // The stats API groups by title and carries no color, so borrow it from a loaded shift
    const colorByTitle = new Map<string, string>();
    for (const shift of shifts) {
      if (!colorByTitle.has(shift.title)) colorByTitle.set(shift.title, shift.color);
    }
    const byType = stats
      ? Object.entries(stats.stats)
          .map(([title, { count }]) => ({
            title,
            count,
            color: colorByTitle.get(title) ?? "var(--brand)",
          }))
          .sort((a, b) => b.count - a.count)
      : [];

    let freeDays: number | null = null;
    if (stats && period === "month") {
      freeDays = getDaysInMonth(anchorDate) - stats.daysWithShifts;
    } else if (stats && period === "week") {
      freeDays = 7 - stats.daysWithShifts;
    } else if (stats) {
      freeDays = getDaysInYear(anchorDate) - stats.daysWithShifts;
    }

    return { stats, freeDays, byType, loading };
  }, [stats, loading, shifts, anchorDate, period]);
}
