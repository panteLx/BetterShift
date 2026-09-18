"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isSameDay, isToday } from "date-fns";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { DayLayoutOptions } from "@/lib/shift-display";
import { cn } from "@/lib/utils";
import {
  DayContent,
  EventChip,
  ExternalShiftChip,
  MinimalSyncCounter,
  NoteLine,
  ShiftChip,
  TODAY_BADGE,
  buildDayContents,
  useDayPress,
  useSignupsEnabled,
} from "@/components/day-cell-entries";
import { useCustomFields } from "@/hooks/useCustomFields";

interface WeekGridProps {
  variant: "desktop" | "phone";
  /** Monday to Sunday */
  days: Date[];
  selectedDay: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  layout: DayLayoutOptions;
  showShiftNotes?: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  onDayClick: (date: Date) => void;
  onDayContextMenu?: (date: Date) => void;
  /** Phone only: swipe left/right across the grid to step the week */
  swipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

export function WeekGrid({
  variant,
  days,
  selectedDay,
  shifts,
  notes,
  externalSyncs,
  togglingDates,
  layout,
  showShiftNotes = false,
  highlightedWeekdays = [],
  highlightColor,
  onDayClick,
  onDayContextMenu,
  swipeHandlers,
}: WeekGridProps) {
  const t = useTranslations();
  const locale = useLocale();
  const signupsEnabled = useSignupsEnabled();
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
  // All shifts in one grid instance share a calendar; falls back to none while shifts are still loading.
  const { customFields: customFieldDefinitions } = useCustomFields(shifts[0]?.calendarId ?? null);
  const desktop = variant === "desktop";

  const { sortType, sortOrder, combinedSort } = layout;
  // The per-day caps exist to fit month cells; a week day shows everything
  const contents = useMemo(
    () =>
      buildDayContents(
        days,
        shifts,
        notes,
        externalSyncs,
        { sortType, sortOrder, combinedSort },
        () => true
      ),
    [days, shifts, notes, externalSyncs, sortType, sortOrder, combinedSort]
  );

  const formatters = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(locale, { weekday: desktop ? "long" : "short" }),
      month: new Intl.DateTimeFormat(locale, { month: "short" }),
    }),
    [locale, desktop]
  );
  const straddlesMonths = days.length > 0 && days[0].getMonth() !== days[days.length - 1].getMonth();

  const renderEntries = (content: DayContent) => (
    <>
      {content.layout.visible.map((shift) =>
        shift.syncedFromExternal ? (
          <ExternalShiftChip key={shift.id} shift={shift} wrap />
        ) : (
          <ShiftChip
            key={shift.id}
            shift={shift}
            showNote={showShiftNotes}
            signupsEnabled={signupsEnabled(shift.calendarId)}
            customFieldDefinitions={customFieldDefinitions}
            interactive
            wrap
          />
        )
      )}
      {content.events.map((note) => (
        <EventChip key={note.id} note={note} wrap />
      ))}
      {content.notes.map((note) => (
        <NoteLine key={note.id} note={note} wrap />
      ))}
    </>
  );

  const isEmpty = (content: DayContent) =>
    content.layout.visible.length === 0 &&
    content.layout.minimalGroups.length === 0 &&
    content.events.length === 0 &&
    content.notes.length === 0;

  return (
    <div
      onTouchStart={swipeHandlers?.onTouchStart}
      onTouchEnd={swipeHandlers?.onTouchEnd}
      className={cn(
        desktop
          ? "mx-[18px] mt-3.5 grid min-h-0 flex-1 grid-cols-7 gap-px border-y border-line bg-line-grid"
          : "flex flex-col px-2"
      )}
    >
      {days.map((day) => {
        const key = formatDateToLocal(day);
        const content = contents.get(key)!;
        const today = isToday(day);
        const selected = isSameDay(day, selectedDay);
        const weekend = day.getDay() === 0 || day.getDay() === 6;
        const highlighted = !!highlightColor && highlightedWeekdays.includes(day.getDay());
        const toggling = togglingDates.has(key);

        const counters = content.layout.minimalGroups.map(({ sync, shifts: synced }) => (
          <MinimalSyncCounter key={sync.id} sync={sync} count={synced.length} />
        ));

        const press = dayPress(day);

        return (
          // A shift chip's own self-assign button must not nest inside another button,
          // so the cell forwards clicks itself and only the day badge stays focusable.
          <div
            key={key}
            onClick={toggling ? undefined : press.onClick}
            onContextMenu={press.onContextMenu}
            onTouchStart={press.onTouchStart}
            onTouchEnd={press.onTouchEnd}
            onTouchMove={press.onTouchMove}
            style={highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined}
            className={cn(
              "relative min-w-0 select-none text-left transition-colors [-webkit-touch-callout:none]",
              desktop
                ? cn(
                    // pb-16: the floating StampDock overlays the bottom of the column, each of which scrolls on its own
                    "flex min-h-0 flex-col items-stretch gap-[3px] overflow-y-auto px-2 pb-16",
                    weekend ? "bg-surface-weekend" : "bg-surface-cell",
                    "hover:bg-surface-panel",
                    selected && "shadow-[inset_0_0_0_1.5px_var(--brand-dot)]"
                  )
                : cn(
                    "flex items-start gap-3 rounded-[10px] px-1.5 py-2.5",
                    selected && "bg-cell-selected"
                  ),
              highlighted && "day-highlight",
              toggling && "cursor-wait opacity-60"
            )}
          >
            {desktop ? (
              <>
                {/* Not sticky: day-highlight paints a background-image, which bg-inherit can't carry */}
                <span className="-mx-2 flex shrink-0 items-center gap-1.5 px-2 pb-1.5 pt-2">
                  <button
                    type="button"
                    disabled={toggling}
                    aria-pressed={selected}
                    aria-label={day.toLocaleDateString()}
                    className={cn(
                      "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1 font-mono text-[12.5px] font-medium leading-none outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                      today ? TODAY_BADGE : "text-fg-body dark:text-fg-secondary"
                    )}
                  >
                    {day.getDate()}
                  </button>
                  <span className="min-w-0 truncate text-[11.5px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">
                    {formatters.weekday.format(day)}
                    {straddlesMonths && ` · ${formatters.month.format(day)}`}
                  </span>
                  {counters.length > 0 && (
                    <span className="ml-auto flex shrink-0 items-center gap-1">{counters}</span>
                  )}
                </span>
                {renderEntries(content)}
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={toggling}
                  aria-pressed={selected}
                  aria-label={day.toLocaleDateString()}
                  className="flex w-10 shrink-0 flex-col items-center gap-0.5 rounded-md pt-0.5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
                >
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-cell-muted">
                    {formatters.weekday.format(day)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex size-[26px] items-center justify-center rounded-full font-mono text-[14px] leading-none",
                      today
                        ? TODAY_BADGE
                        : weekend
                          ? "font-[450] text-cell-weekend-num"
                          : "font-[450] text-fg-body"
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
                <span className="flex min-w-0 flex-1 flex-col gap-1 border-b border-line pb-2.5">
                  {counters.length > 0 && <span className="flex flex-wrap gap-1">{counters}</span>}
                  {renderEntries(content)}
                  {isEmpty(content) && (
                    <span className="py-1 text-[12.5px] text-fg-faint">{t("calendarView.dayFree")}</span>
                  )}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
