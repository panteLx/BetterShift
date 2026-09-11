import { PRESET_COLORS } from "@/lib/constants";
import type { ShiftSortOrder, ShiftSortType } from "@/lib/shift-display";

/** Display options a calendar can pin for everyone with access to it. */
export interface CalendarViewSettings {
  /** null shows as many as fit into the cell */
  shiftsPerDay: number | null;
  externalShiftsPerDay: number | null;
  showShiftNotes: boolean;
  sortType: ShiftSortType;
  sortOrder: ShiftSortOrder;
  combinedSort: boolean;
  /** 0 = Sunday … 6 = Saturday, unique and sorted */
  highlightedWeekdays: number[];
  highlightColor: string;
}

/** A user's own view; the stamp bar is never taken over by a calendar. */
export interface PersonalViewSettings extends CalendarViewSettings {
  showStampBar: boolean;
}

export const SHIFTS_PER_DAY_MAX = 3;

const SORT_TYPES: readonly ShiftSortType[] = ["startTime", "createdAt", "title"];
const SORT_ORDERS: readonly ShiftSortOrder[] = ["asc", "desc"];
const HEX_COLOR = /^#[0-9a-f]{6}$/;
const LEGACY_DEFAULT_HIGHLIGHT_COLOR = "#fbbf24";

export const DEFAULT_HIGHLIGHT_COLOR =
  PRESET_COLORS.find((c) => c.name === "Amber")?.value ?? "#d97706";

export const DEFAULT_CALENDAR_VIEW_SETTINGS: CalendarViewSettings = {
  shiftsPerDay: 3,
  externalShiftsPerDay: 3,
  showShiftNotes: false,
  sortType: "createdAt",
  sortOrder: "asc",
  combinedSort: false,
  highlightedWeekdays: [],
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
};

export const DEFAULT_PERSONAL_VIEW_SETTINGS: PersonalViewSettings = {
  ...DEFAULT_CALENDAR_VIEW_SETTINGS,
  showStampBar: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLimit(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const limit = Math.max(1, Math.round(value));
  // Month cells show at most four rows, so any higher limit behaves like filling the cell
  return limit > SHIFTS_PER_DAY_MAX ? null : limit;
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function sanitizeWeekdays(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const days = value.filter(
    (d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6
  );
  return Array.from(new Set(days)).sort((a, b) => a - b);
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const color = value.trim().toLowerCase();
  if (color === LEGACY_DEFAULT_HIGHLIGHT_COLOR) return DEFAULT_HIGHLIGHT_COLOR;
  return HEX_COLOR.test(color) ? color : fallback;
}

/** Whitelists and normalises calendar keys; anything missing or invalid falls back to the default. */
export function sanitizeCalendarViewSettings(input: unknown): CalendarViewSettings {
  const src = isRecord(input) ? input : {};
  const d = DEFAULT_CALENDAR_VIEW_SETTINGS;
  return {
    shiftsPerDay: sanitizeLimit(src.shiftsPerDay, d.shiftsPerDay),
    externalShiftsPerDay: sanitizeLimit(src.externalShiftsPerDay, d.externalShiftsPerDay),
    showShiftNotes: sanitizeBoolean(src.showShiftNotes, d.showShiftNotes),
    sortType: sanitizeEnum(src.sortType, SORT_TYPES, d.sortType),
    sortOrder: sanitizeEnum(src.sortOrder, SORT_ORDERS, d.sortOrder),
    combinedSort: sanitizeBoolean(src.combinedSort, d.combinedSort),
    highlightedWeekdays: sanitizeWeekdays(src.highlightedWeekdays, d.highlightedWeekdays),
    highlightColor: sanitizeColor(src.highlightColor, d.highlightColor),
  };
}

export function sanitizePersonalViewSettings(input: unknown): PersonalViewSettings {
  const src = isRecord(input) ? input : {};
  return {
    ...sanitizeCalendarViewSettings(src),
    showStampBar: sanitizeBoolean(src.showStampBar, DEFAULT_PERSONAL_VIEW_SETTINGS.showStampBar),
  };
}

/** The calendar-level subset of a personal view, e.g. to seed a calendar's own view. */
export function pickCalendarViewSettings(settings: CalendarViewSettings): CalendarViewSettings {
  return sanitizeCalendarViewSettings(settings);
}

export function calendarViewSettingsEqual(a: CalendarViewSettings, b: CalendarViewSettings): boolean {
  const x = sanitizeCalendarViewSettings(a);
  const y = sanitizeCalendarViewSettings(b);
  return (Object.keys(x) as (keyof CalendarViewSettings)[]).every((key) =>
    key === "highlightedWeekdays"
      ? x.highlightedWeekdays.join(",") === y.highlightedWeekdays.join(",")
      : x[key] === y[key]
  );
}

/** A calendar's own view replaces the personal one as a whole; the stamp bar stays personal. */
export function resolveViewSettings(
  personal: PersonalViewSettings,
  calendarView: unknown
): PersonalViewSettings {
  if (!isRecord(calendarView)) return personal;
  return { ...sanitizeCalendarViewSettings(calendarView), showStampBar: personal.showStampBar };
}
