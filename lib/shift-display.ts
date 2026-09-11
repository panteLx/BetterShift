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
  /** Everything that would render as a chip without limits */
  displayable: ShiftWithCalendar[];
  /** External syncs in "minimal" mode collapse into one counter each */
  minimalGroups: { sync: ExternalSync; shifts: ShiftWithCalendar[] }[];
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getShiftsForDay(
  shifts: ShiftWithCalendar[],
  day: Date
): ShiftWithCalendar[] {
  return shifts.filter(
    (shift) => shift.date && isSameLocalDay(shift.date as Date, day)
  );
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
    displayable: [...regular, ...external],
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

/** One-letter stamp code used where only a block fits (stamp dock, preset list, compare). */
export function getShiftCode(title: string): string {
  const first = Array.from(title.trim())[0];
  return first ? first.toLocaleUpperCase() : "·";
}

export function formatHours(minutes: number, locale: string): string {
  const hours = minutes / 60;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours)}h`;
}

export function formatTimeRange(shift: ShiftWithCalendar): string {
  return `${shift.startTime.slice(0, 5)} – ${shift.endTime.slice(0, 5)}`;
}
