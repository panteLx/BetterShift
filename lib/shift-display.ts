import { CSSProperties } from "react";
import { isSameDay } from "date-fns";
import { ShiftWithCalendar } from "@/lib/types";
import { ExternalSync } from "@/lib/db/schema";
import { calculateShiftDuration } from "@/lib/date-utils";

export type ShiftSortType = "startTime" | "createdAt" | "title";
export type ShiftSortOrder = "asc" | "desc";

export interface DayLayoutOptions {
  maxShifts?: number;
  maxExternalShifts?: number;
  sortType?: ShiftSortType;
  sortOrder?: ShiftSortOrder;
  combinedSort?: boolean;
}

export interface DayShiftLayout {
  /** Chips to render in the cell, already sorted and capped */
  visible: ShiftWithCalendar[];
  /** Shifts cut by the per-day limits */
  hiddenCount: number;
  /** The part of hiddenCount that came from external syncs */
  hiddenExternalCount: number;
  /** External syncs in "minimal" mode collapse into one counter each */
  minimalGroups: { sync: ExternalSync; shifts: ShiftWithCalendar[] }[];
}

export function getShiftsForDay(
  shifts: ShiftWithCalendar[],
  day: Date
): ShiftWithCalendar[] {
  return shifts.filter((shift) => shift.date && isSameDay(shift.date as Date, day));
}

/** The day's shifts in start-time order — the shape every day view needs. */
export function getDayShifts(
  shifts: ShiftWithCalendar[],
  day: Date
): ShiftWithCalendar[] {
  return sortShifts(getShiftsForDay(shifts, day), "startTime");
}

export function sortShifts(
  shifts: ShiftWithCalendar[],
  type: ShiftSortType = "startTime",
  order: ShiftSortOrder = "asc"
): ShiftWithCalendar[] {
  return [...shifts].sort((a, b) => {
    let comparison = 0;
    switch (type) {
      case "startTime":
        comparison = a.startTime.localeCompare(b.startTime);
        break;
      case "createdAt": {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = aTime - bTime;
        break;
      }
      case "title":
        comparison = a.title.localeCompare(b.title);
        break;
    }
    return order === "asc" ? comparison : -comparison;
  });
}

export function buildDayShiftLayout(
  dayShifts: ShiftWithCalendar[],
  externalSyncs: ExternalSync[],
  {
    maxShifts,
    maxExternalShifts,
    sortType = "createdAt",
    sortOrder = "asc",
    combinedSort = false,
  }: DayLayoutOptions = {}
): DayShiftLayout {
  const syncById = new Map(externalSyncs.map((s) => [s.id, s]));
  const modeOf = (shift: ShiftWithCalendar) =>
    shift.externalSyncId
      ? syncById.get(shift.externalSyncId)?.displayMode
      : undefined;

  const regular = sortShifts(
    dayShifts.filter((s) => !s.syncedFromExternal),
    sortType,
    sortOrder
  );
  const external = sortShifts(
    dayShifts.filter((s) => s.syncedFromExternal && modeOf(s) === "normal"),
    sortType,
    sortOrder
  );

  const shownRegular =
    maxShifts === undefined ? regular : regular.slice(0, maxShifts);
  const shownExternal =
    maxExternalShifts === undefined
      ? external
      : external.slice(0, maxExternalShifts);

  let visible: ShiftWithCalendar[];
  if (combinedSort) {
    const shownIds = new Set([...shownRegular, ...shownExternal].map((s) => s.id));
    visible = sortShifts([...regular, ...external], sortType, sortOrder).filter(
      (s) => shownIds.has(s.id)
    );
  } else {
    visible = [...shownRegular, ...shownExternal];
  }

  const minimal = new Map<string, ShiftWithCalendar[]>();
  for (const shift of dayShifts) {
    if (shift.syncedFromExternal && shift.externalSyncId && modeOf(shift) === "minimal") {
      const list = minimal.get(shift.externalSyncId) ?? [];
      list.push(shift);
      minimal.set(shift.externalSyncId, list);
    }
  }

  return {
    visible,
    hiddenCount:
      regular.length - shownRegular.length + external.length - shownExternal.length,
    hiddenExternalCount: external.length - shownExternal.length,
    minimalGroups: [...minimal.entries()].flatMap(([id, shifts]) => {
      const sync = syncById.get(id);
      return sync ? [{ sync, shifts }] : [];
    }),
  };
}

export function getShiftMinutes(shift: ShiftWithCalendar): number {
  return shift.isAllDay
    ? 0
    : calculateShiftDuration(shift.startTime, shift.endTime);
}

export function sumShiftMinutes(shifts: ShiftWithCalendar[]): number {
  return shifts.reduce((total, shift) => total + getShiftMinutes(shift), 0);
}

/** Shift colour for the `shift-chip` / `shift-solid` / `shift-rail` utilities. */
export function shiftVars(color?: string | null): CSSProperties {
  return { "--shift": color || undefined } as CSSProperties;
}

/** One-letter stamp code used where only a block fits (stamp dock, preset list, compare). */
export function getShiftCode(title: string): string {
  const first = Array.from(title.trim())[0];
  return first ? first.toLocaleUpperCase() : "·";
}

const hourFormatters = new Map<string, Intl.NumberFormat>();

function hourFormatter(locale: string): Intl.NumberFormat {
  let formatter = hourFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    hourFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatHours(
  minutes: number,
  locale: string,
  { unit = true }: { unit?: boolean } = {}
): string {
  const hours = hourFormatter(locale).format(minutes / 60);
  return unit ? `${hours}h` : hours;
}

export function presetTime(
  preset: { isAllDay: boolean; startTime: string; endTime: string },
  allDayLabel: string
): string {
  return preset.isAllDay ? allDayLabel : formatTimeRange(preset);
}

export function formatTimeRange(times: {
  startTime: string;
  endTime: string;
}): string {
  return `${times.startTime.slice(0, 5)} – ${times.endTime.slice(0, 5)}`;
}
