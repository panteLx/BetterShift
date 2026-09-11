"use client";

import { useEffect, useRef } from "react";
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
  getShiftCode,
  getShiftsForDay,
  isSameLocalDay,
} from "@/lib/shift-display";
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

const MOBILE_MAX_BLOCKS = 2;
const LONG_PRESS_MS = 500;

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
    <div className="flex min-h-0 flex-1 flex-col">
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
        className={cn(
          "grid min-h-0 flex-1 grid-cols-7 gap-px bg-line-grid",
          full
            ? "mx-2 auto-rows-[minmax(92px,auto)] lg:mx-[18px] lg:auto-rows-[minmax(0,1fr)]"
            : "mx-4 auto-rows-[minmax(0,1fr)]"
        )}
      >
        {calendarDays.map((day) => {
          const key = formatDateToLocal(day);
          const inMonth = day.getMonth() === currentDate.getMonth();
          const today = isToday(day);
          const selected = isSameLocalDay(day, selectedDay);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const highlighted = highlightedWeekdays.includes(day.getDay());
          const toggling = togglingDates.has(key);

          const dayNotes = inMonth ? findNotesForDate(notes, day) : [];
          const events = dayNotes.filter((n) => n.type === "event");
          const plainNotes = dayNotes.length - events.length;
          const dayShifts = inMonth ? getShiftsForDay(shifts, day) : [];
          const { visible, hiddenCount, minimalGroups } = buildDayShiftLayout(
            dayShifts,
            externalSyncs,
            layout
          );
          const mobileVisible = visible.slice(0, MOBILE_MAX_BLOCKS);
          const mobileHidden =
            visible.length - mobileVisible.length + hiddenCount;

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
                highlighted && highlightColor && !today
                  ? {
                      backgroundColor: `color-mix(in oklch, ${highlightColor} 9%, var(--surface-cell))`,
                    }
                  : undefined
              }
              className={cn(
                "relative flex min-h-0 min-w-0 select-none flex-col overflow-hidden text-left outline-none transition-colors [-webkit-touch-callout:none]",
                full
                  ? "items-center px-1 py-[5px] lg:items-stretch lg:px-[9px] lg:py-2"
                  : "items-stretch px-[9px] py-2",
                today
                  ? "bg-surface-today"
                  : weekend
                    ? "bg-surface-weekend"
                    : "bg-surface-cell",
                !today && "hover:bg-surface-panel",
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
                  full ? "mb-1 justify-center lg:mb-1.5 lg:justify-between" : "mb-1.5 justify-between"
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
                {full && mobileHidden > 0 && (
                  <span className="rounded-[4px] bg-brand-soft px-[3px] py-px font-mono text-[9.5px] font-bold text-brand-ink lg:hidden">
                    +{mobileHidden}
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

              {/* Mobile event tag */}
              {full && events[0] && (
                <span
                  className="shift-chip mb-1 w-full truncate rounded-[4px] px-[3px] py-0.5 text-center text-[10px] font-semibold lg:hidden"
                  style={{ "--shift": events[0].color || "var(--brand)" } as React.CSSProperties}
                >
                  {events[0].note}
                </span>
              )}

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

              {/* Mobile blocks */}
              <div className={cn("w-full min-w-0 flex-col gap-[3px] lg:hidden", full ? "flex" : "hidden")}>
                {mobileVisible.map((shift) => (
                  <span
                    key={shift.id}
                    className="shift-solid flex min-w-0 flex-col items-center rounded-[5px] px-1 py-0.5 leading-[1.2]"
                    style={{ "--shift": shift.color } as React.CSSProperties}
                  >
                    <span className="text-[11px] font-bold tracking-[0.02em]">
                      {getShiftCode(shift.title)}
                    </span>
                    <span className="font-mono text-[11px] font-medium">
                      {shift.isAllDay
                        ? t("calendarView.allDayTiny")
                        : shift.startTime.slice(0, 5)}
                    </span>
                  </span>
                ))}
                {minimalGroups.length > 0 && mobileVisible.length < MOBILE_MAX_BLOCKS && (
                  <span className="flex items-center justify-center gap-0.5 rounded-[5px] bg-surface-sunken py-0.5 text-[10px] font-semibold text-fg-secondary">
                    <RefreshCw className="size-2.5" />
                    {minimalGroups.reduce((sum, g) => sum + g.shifts.length, 0)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
