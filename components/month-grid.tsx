"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isToday } from "date-fns";
import { RefreshCw, StickyNote } from "lucide-react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { findNotesForDate } from "@/lib/event-utils";
import {
  buildDayShiftLayout,
  DayLayoutOptions,
  DayShiftLayout,
  getShiftsForDay,
  isSameLocalDay,
} from "@/lib/shift-display";
import { DESKTOP_QUERY } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const LONG_PRESS_MS = 500;

// Phone cell geometry in px. These mirror the Tailwind sizes of the phone markup
// below; change both together or the capacity math clips items.
const PHONE_MIN_ROW = 86; // two shift rows fit: 86 - CHROME = 2 * ITEM + GAP
const PHONE_CHROME = 31; // 3 padding + 22 day number + 3 gap + 3 padding
const PHONE_GAP = 2;
const PHONE_ITEM_PAD = 4;
const PHONE_TITLE_LINE = 12;
const PHONE_SUB_LINE = 10;
const PHONE_PILL = 14;
const PHONE_EVENT = 14;
const PHONE_TEXT_INSET = 14; // cell padding 6 + rail 2 + item padding 6
const PHONE_CHAR_PX = 6.2; // generous average for 10.5px semibold
const PHONE_SYNC_ICON = 10;

type MinimalGroup = DayShiftLayout["minimalGroups"][number];

interface PhoneFit {
  shifts: ShiftWithCalendar[];
  groups: MinimalGroup[];
  hidden: number;
}

/** Picks what fits into one phone cell, in layout order with minimal-sync pills last. */
function fitPhoneCell(
  { visible, hiddenCount, minimalGroups }: DayShiftLayout,
  hasEvents: boolean,
  rowHeight: number,
  colWidth: number,
  showFullTitles: boolean,
  showShiftNotes: boolean
): PhoneFit {
  let space = rowHeight - PHONE_CHROME - (hasEvents ? PHONE_EVENT + PHONE_GAP : 0);
  let placed = 0;
  const place = (height: number) => {
    const cost = placed === 0 ? height : height + PHONE_GAP;
    if (cost > space) return false;
    space -= cost;
    placed++;
    return true;
  };

  const textWidth = colWidth - PHONE_TEXT_INSET;
  const shifts: ShiftWithCalendar[] = [];
  for (const shift of visible) {
    const titleWidth =
      shift.title.length * PHONE_CHAR_PX + (shift.syncedFromExternal ? PHONE_SYNC_ICON : 0);
    const titleLines = showFullTitles && titleWidth > textWidth ? 2 : 1;
    const height =
      PHONE_ITEM_PAD +
      titleLines * PHONE_TITLE_LINE +
      PHONE_SUB_LINE +
      (showShiftNotes && shift.notes ? PHONE_SUB_LINE : 0);
    if (!place(height)) break;
    shifts.push(shift);
  }

  const groups: MinimalGroup[] = [];
  if (shifts.length === visible.length) {
    for (const group of minimalGroups) {
      if (!place(PHONE_PILL)) break;
      groups.push(group);
    }
  }

  const droppedMinimal = minimalGroups
    .slice(groups.length)
    .reduce((sum, group) => sum + group.shifts.length, 0);
  return {
    shifts,
    groups,
    hidden: hiddenCount + visible.length - shifts.length + droppedMinimal,
  };
}

/** Grid box size, tracked only below the desktop breakpoint where the phone cells need it. */
function usePhoneGridSize(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new ResizeObserver(() => {
      if (window.matchMedia(DESKTOP_QUERY).matches) return;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return [ref, size] as const;
}

interface MonthGridProps {
  calendarDays: Date[];
  currentDate: Date;
  selectedDay: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  layout: DayLayoutOptions;
  showShiftNotes?: boolean;
  showFullTitles?: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  onDayClick: (date: Date) => void;
  onDayContextMenu?: (date: Date) => void;
  /** "compare" is the narrow desktop column used side by side in compare mode */
  variant?: "full" | "compare";
}

export function MonthGrid({
  calendarDays,
  currentDate,
  selectedDay,
  shifts,
  notes,
  externalSyncs,
  togglingDates,
  layout,
  showShiftNotes = false,
  showFullTitles = false,
  highlightedWeekdays = [],
  highlightColor,
  onDayClick,
  onDayContextMenu,
  variant = "full",
}: MonthGridProps) {
  const t = useTranslations();
  const full = variant === "full";
  const locale = useLocale();
  // 2024-01-01 was a Monday
  const longWeekdays = WEEKDAY_KEYS.map((_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2024, 0, 1 + i))
  );
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const [gridRef, gridSize] = usePhoneGridSize(full);
  const rows = Math.max(1, Math.ceil(calendarDays.length / 7));
  // Until measured this falls back to the minimum row height
  const phoneRowHeight = Math.max(
    PHONE_MIN_ROW,
    Math.floor((gridSize.height - (rows - 1)) / rows)
  );
  const phoneColWidth = gridSize.width > 0 ? (gridSize.width - 6) / 7 : 48;

  useEffect(
    () => () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    []
  );

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    // On phones the grid may not shrink below its minimum rows, so the page scrolls instead
    <div className={cn("flex flex-1 flex-col", full ? "lg:min-h-0" : "min-h-0")}>
      <div
        className={cn(
          "grid grid-cols-7 border-b border-line",
          full ? "px-2 lg:px-[18px] lg:pt-3.5" : "px-4 pt-3"
        )}
      >
        {WEEKDAY_KEYS.map((key, index) => (
          <div
            key={key}
            className={cn(
              "font-semibold uppercase tracking-[0.06em] text-fg-tertiary",
              full
                ? "py-2 text-center text-[11px] lg:px-2.5 lg:pb-2 lg:pt-0 lg:text-left lg:text-[11.5px]"
                : "px-2.5 pb-2 text-[11px]"
            )}
          >
            <span className={full ? "lg:hidden" : ""}>
              {t(`calendarView.weekdayShort.${key}`)}
            </span>
            {full && <span className="hidden lg:inline">{longWeekdays[index]}</span>}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        className={cn(
          "grid flex-1 grid-cols-7 gap-px bg-line-grid",
          full
            ? "mx-2 auto-rows-[minmax(86px,1fr)] lg:mx-[18px] lg:min-h-0 lg:auto-rows-[minmax(0,1fr)]"
            : "mx-4 min-h-0 auto-rows-[minmax(0,1fr)]"
        )}
      >
        {calendarDays.map((day) => {
          const key = formatDateToLocal(day);
          const inMonth = day.getMonth() === currentDate.getMonth();
          const today = isToday(day);
          const selected = isSameLocalDay(day, selectedDay);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const highlighted =
            !!highlightColor && !today && highlightedWeekdays.includes(day.getDay());
          const toggling = togglingDates.has(key);

          const dayNotes = inMonth ? findNotesForDate(notes, day) : [];
          const events = dayNotes.filter((n) => n.type === "event");
          const plainNotes = dayNotes.length - events.length;
          const dayShifts = inMonth ? getShiftsForDay(shifts, day) : [];
          const dayLayout = buildDayShiftLayout(dayShifts, externalSyncs, layout);
          const { visible, hiddenCount, minimalGroups } = dayLayout;
          const phone = full
            ? fitPhoneCell(
                dayLayout,
                events.length > 0,
                phoneRowHeight,
                phoneColWidth,
                showFullTitles,
                showShiftNotes
              )
            : null;

          return (
            <button
              key={key}
              type="button"
              disabled={toggling}
              aria-pressed={selected}
              aria-label={day.toLocaleDateString()}
              onClick={() => {
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                onDayClick(day);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onDayContextMenu?.(day);
              }}
              onTouchStart={() => {
                longPressed.current = false;
                if (!onDayContextMenu) return;
                pressTimer.current = setTimeout(() => {
                  longPressed.current = true;
                  onDayContextMenu(day);
                }, LONG_PRESS_MS);
              }}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              style={
                highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined
              }
              className={cn(
                "relative flex min-h-0 min-w-0 select-none flex-col overflow-hidden text-left outline-none transition-colors [-webkit-touch-callout:none]",
                // Size containment keeps phone cell content from growing the rows
                full
                  ? "items-stretch p-[3px] max-lg:[contain:size] lg:px-[9px] lg:py-2"
                  : "items-stretch px-[9px] py-2",
                today
                  ? "bg-surface-today"
                  : weekend
                    ? "bg-surface-weekend"
                    : "bg-surface-cell",
                !today && "hover:bg-surface-panel",
                highlighted && "day-highlight",
                !inMonth && "opacity-45",
                selected && "shadow-[inset_0_0_0_1.5px_var(--brand-dot)]",
                toggling && "cursor-wait opacity-60",
                "focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
              )}
            >
              {/* Day number row */}
              <div
                className={cn(
                  "flex w-full items-center gap-1.5",
                  full ? "mb-[3px] justify-between lg:mb-1.5" : "mb-1.5 justify-between"
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-medium leading-none",
                    today
                      ? "bg-brand font-semibold text-white dark:bg-brand-dot dark:text-[#0a1020]"
                      : inMonth
                        ? "text-fg-body"
                        : "text-fg-tertiary"
                  )}
                >
                  {day.getDate()}
                </span>
                {!full && hiddenCount > 0 && (
                  <span className="ml-auto rounded-[4px] bg-brand-soft px-1 py-px font-mono text-[10px] font-bold text-brand-ink">
                    +{hiddenCount}
                  </span>
                )}
                {phone && (plainNotes > 0 || phone.hidden > 0) && (
                  // Negative margin lets both indicators reach into the number box's empty side on narrow phones
                  <span className="-ml-3.5 flex shrink-0 items-center gap-px lg:hidden">
                    {plainNotes > 0 && (
                      <StickyNote
                        className="size-2.5 shrink-0 text-warning"
                        aria-label={t("calendarView.hasNotes", { count: plainNotes })}
                      />
                    )}
                    {phone.hidden > 0 && (
                      <span className="rounded-[3px] bg-brand-soft px-[2px] font-mono text-[9px] font-bold leading-[12px] text-brand-ink">
                        +{phone.hidden}
                      </span>
                    )}
                  </span>
                )}
                <span
                  className={cn(
                    "min-w-0 items-center gap-1",
                    full ? "hidden lg:flex" : "flex"
                  )}
                >
                  {plainNotes > 0 && (
                    <StickyNote
                      className="size-3.5 shrink-0 text-warning"
                      aria-label={t("calendarView.hasNotes", { count: plainNotes })}
                    />
                  )}
                  {events[0] && (
                    <span
                      className="shift-chip max-w-[88px] truncate rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold"
                      style={{ "--shift": events[0].color || "var(--brand)" } as React.CSSProperties}
                      title={events.map((e) => e.note).join("\n")}
                    >
                      {events[0].note}
                      {events.length > 1 && ` +${events.length - 1}`}
                    </span>
                  )}
                </span>
              </div>

              {/* Desktop chips */}
              <div
                className={cn(
                  "min-w-0 flex-col gap-[3px]",
                  full ? "hidden lg:flex" : "flex"
                )}
              >
                {!full &&
                  visible.map((shift) => (
                    <span
                      key={shift.id}
                      className="flex min-w-0 items-center gap-1.5 rounded-sm bg-surface-sunken/70 px-1.5 py-[3px] text-[11.5px] text-fg-body"
                      title={`${shift.title} · ${
                        shift.isAllDay ? t("shift.allDayShift") : `${shift.startTime}–${shift.endTime}`
                      }`}
                    >
                      <span
                        className="shift-rail h-[13px] w-[3px] shrink-0 rounded-full"
                        style={{ "--shift": shift.color } as React.CSSProperties}
                      />
                      <span className="min-w-0 flex-1 truncate">{shift.title}</span>
                    </span>
                  ))}
                {full && visible.map((shift) => (
                  <span
                    key={shift.id}
                    className="shift-chip flex min-w-0 items-center gap-1.5 rounded-sm px-[7px] py-[3px] text-[11.5px]"
                    style={{ "--shift": shift.color } as React.CSSProperties}
                    title={`${shift.title}${shift.notes ? `\n${shift.notes}` : ""}`}
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 font-medium",
                        showFullTitles ? "break-words" : "truncate"
                      )}
                    >
                      {shift.title}
                      {showShiftNotes && shift.notes && (
                        <span className="block truncate text-[10.5px] font-normal opacity-75">
                          {shift.notes}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 self-start font-mono text-[10.5px] opacity-75">
                      {shift.isAllDay
                        ? t("calendarView.allDayShort")
                        : shift.startTime.slice(0, 5)}
                    </span>
                  </span>
                ))}
                {minimalGroups.map(({ sync, shifts: syncShifts }) => (
                  <span
                    key={sync.id}
                    className="shift-chip flex items-center gap-1.5 rounded-sm px-[7px] py-[3px] text-[11.5px] font-medium"
                    style={{ "--shift": sync.color } as React.CSSProperties}
                    title={sync.name}
                  >
                    <RefreshCw className="size-3 shrink-0" />
                    <span className="truncate">
                      {t("calendarView.externalCount", { count: syncShifts.length })}
                    </span>
                  </span>
                ))}
                {full && hiddenCount > 0 && (
                  <span className="pl-0.5 text-[11.5px] font-medium text-brand-ink">
                    {t("calendarView.moreShifts", { count: hiddenCount })}
                  </span>
                )}
              </div>

              {/* Phone rows; heights must match the PHONE_* constants */}
              {phone && (
                <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[2px] overflow-hidden lg:hidden">
                  {phone.shifts.map((shift) => (
                    <span
                      key={shift.id}
                      className="shift-chip flex min-w-0 shrink-0 flex-col rounded-[4px] border-l-2 border-l-[color:var(--shift-base)] px-[3px] py-[2px]"
                      style={{ "--shift": shift.color } as React.CSSProperties}
                    >
                      <span
                        className={cn(
                          "text-[10.5px] font-semibold leading-[12px]",
                          showFullTitles ? "line-clamp-2 break-words" : "truncate"
                        )}
                      >
                        {shift.syncedFromExternal && (
                          <RefreshCw className="mr-px inline size-2 align-baseline" />
                        )}
                        {shift.title}
                      </span>
                      <span className="font-mono text-[9.5px] leading-[10px] opacity-75">
                        {shift.isAllDay
                          ? t("calendarView.allDayTiny")
                          : shift.startTime.slice(0, 5)}
                      </span>
                      {showShiftNotes && shift.notes && (
                        <span className="truncate text-[9px] leading-[10px] opacity-70">
                          {shift.notes}
                        </span>
                      )}
                    </span>
                  ))}
                  {phone.groups.map(({ sync, shifts: syncShifts }) => (
                    <span
                      key={sync.id}
                      className="shift-chip flex shrink-0 items-center gap-[2px] self-start rounded-[4px] px-[3px] py-px font-mono text-[9.5px] font-semibold leading-[12px]"
                      style={{ "--shift": sync.color } as React.CSSProperties}
                    >
                      <RefreshCw className="size-2 shrink-0" />
                      {syncShifts.length}
                    </span>
                  ))}
                </div>
              )}
              {phone && events[0] && (
                <span
                  className="shift-chip mt-[2px] flex w-full min-w-0 shrink-0 items-center gap-px rounded-[4px] px-[3px] py-px text-[10px] font-semibold leading-[12px] lg:hidden"
                  style={{ "--shift": events[0].color || "var(--brand)" } as React.CSSProperties}
                >
                  <span className="min-w-0 truncate">{events[0].note}</span>
                  {events.length > 1 && (
                    <span className="shrink-0 font-mono">+{events.length - 1}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
