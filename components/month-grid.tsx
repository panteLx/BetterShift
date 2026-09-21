"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isSameDay, isToday } from "date-fns";
import { CalendarClock, RefreshCw, StickyNote } from "lucide-react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { DayLayoutOptions, shiftVars } from "@/lib/shift-display";
import { cn } from "@/lib/utils";
import {
  DayContent,
  EventChip,
  ExternalShiftChip,
  MinimalSyncCounter,
  NoteLine,
  ShiftChip,
  SignupBadge,
  signupBadgeLabel,
  TODAY_BADGE,
  buildDayContents,
  useDayPress,
  useSignupsEnabled,
} from "@/components/day-cell-entries";
import { hasVisibleCustomFields } from "@/components/custom-field-summary";
import { useCustomFields } from "@/hooks/useCustomFields";
import { cellFont, cellMonoFont, countWrappedLines, textWidth } from "@/lib/text-measure";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

// Cell geometry in px. These mirror the Tailwind sizes of the cell markup below;
// change both together or the fitting clips rows.
const DESKTOP_MAX_ROWS = 4;
const DESKTOP_CHROME = 37; // 7 + 7 padding, 20 day number, 3 gap
const DESKTOP_GAP = 3;
const DESKTOP_ROW = 20;
const DESKTOP_PLAIN_ROW = 18;
const DESKTOP_SUB_LINE = 14;
const DESKTOP_OVERFLOW = 14;
const DESKTOP_TITLE_LINE = 16; // a second title line, leading-4
// Horizontal chip geometry: cell px-2, chip pl-[5px]/pr-[7px], gap-1.5 between the columns
const DESKTOP_CELL_PAD = 16;
const DESKTOP_CHIP_PAD = 12;
const DESKTOP_GAP_X = 6;
const DESKTOP_RAIL = 3;
const DESKTOP_SYNC_ICON = 12;
const DESKTOP_SPLIT_ICON = 11; // size-[9px] plus its gap-0.5
const DESKTOP_TIME_MAX = 0.45; // ChipTime is capped at max-w-[45%]
const DESKTOP_BADGE_PAD = 8;

const PHONE_MIN_ROW = 84; // two fields plus the counter
const PHONE_CHROME = 30; // 5 padding, 22 head, 3 gap
const PHONE_GAP = 2;
const PHONE_FIELD = 19;
const PHONE_FIELD_WRAP = 20; // py-[3px] plus one leading-[14px] line
const PHONE_FIELD_WRAP_LINE = 14;
const PHONE_FIELD_PAD = 12; // cell px-[2px], field px-1
const PHONE_COUNTER = 12;
const PHONE_MAX_FIELDS = 3;
const PHONE_HEAD_FIXED = 32; // 4 cell padding, 3 head padding, 22 day number, 3 gap
const PHONE_MARK = 10;
const PHONE_MAX_MARKS = 3;
const PHONE_FALLBACK_COL = 54; // 390px viewport, used until the grid is measured
const MAX_TITLE_LINES = 2;

/** Width left for the title beside the rail/icon, the optional signup badge and the time. */
function desktopTitleWidth(
  colWidth: number,
  leading: number,
  timeWidth: number,
  badgeWidth: number
): number {
  const inner = colWidth - DESKTOP_CELL_PAD - DESKTOP_CHIP_PAD - leading - DESKTOP_GAP_X;
  const time = Math.min(timeWidth, inner * DESKTOP_TIME_MAX);
  return inner - DESKTOP_GAP_X - time - (badgeWidth > 0 ? badgeWidth + DESKTOP_GAP_X : 0);
}

type Variant = "desktop" | "phone" | "compare";

/** Desktop rows in cell order; "count" is a count-only external sync */
type CellEntry =
  | { kind: "shift" | "external"; key: string; shift: ShiftWithCalendar }
  | { kind: "event" | "note"; key: string; note: CalendarNote };

/** How many items fit into `space`, keeping room for an overflow line whenever something stays hidden. */
function fitCount(
  heights: number[],
  alreadyHidden: number,
  space: number,
  max: number,
  gap: number,
  overflow: number
): number {
  let used = 0;
  let shown = 0;
  for (let i = 0; i < heights.length && shown < max; i++) {
    const cost = heights[i] + (shown > 0 ? gap : 0);
    const hiddenAfter = heights.length - i - 1 + alreadyHidden;
    const reserve = hiddenAfter > 0 ? gap + overflow : 0;
    if (used + cost + reserve > space) break;
    used += cost;
    shown++;
  }
  return shown;
}

/** Runs of adjacent highlighted columns (Monday first), so neighbouring days share one band. */
function highlightBands(weekdays: number[]): { start: number; span: number }[] {
  const bands: { start: number; span: number }[] = [];
  for (let col = 0; col < 7; col++) {
    if (!weekdays.includes((col + 1) % 7)) continue;
    const last = bands[bands.length - 1];
    if (last && last.start + last.span === col) last.span++;
    else bands.push({ start: col, span: 1 });
  }
  return bands;
}

/** Grid box size; both month layouts fit their cells to it. */
function useGridSize(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const observer = new ResizeObserver(() => {
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
  /** Desktop only: a shift's own note as a second line */
  showShiftNotes?: boolean;
  /** Personal setting: let a long title wrap instead of cutting it off */
  wrapShiftTitles?: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  onDayClick: (date: Date) => void;
  onDayContextMenu?: (date: Date) => void;
  /** "compare" is the narrow desktop column used side by side in compare mode */
  variant?: Variant;
  /** Phone only: swipe left/right across the grid to step the month */
  swipeHandlers?: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
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
  wrapShiftTitles = false,
  highlightedWeekdays = [],
  highlightColor,
  onDayClick,
  onDayContextMenu,
  variant = "desktop",
  swipeHandlers,
}: MonthGridProps) {
  const t = useTranslations();
  const locale = useLocale();
  const signupsEnabled = useSignupsEnabled();
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
  // All shifts in one grid instance share a calendar; falls back to none while shifts are still loading.
  const { customFields: customFieldDefinitions } = useCustomFields(shifts[0]?.calendarId ?? null);
  const phone = variant === "phone";
  const desktop = variant === "desktop";
  // 2024-01-01 was a Monday
  const longWeekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: "long" });
    return WEEKDAY_KEYS.map((_, i) => formatter.format(new Date(2024, 0, 1 + i)));
  }, [locale]);
  const [gridRef, gridSize] = useGridSize(variant !== "compare");
  const rows = Math.max(1, Math.ceil(calendarDays.length / 7));
  const measured = gridSize.height > 0;
  const rowHeight = phone
    ? Math.max(PHONE_MIN_ROW, (gridSize.height - (rows - 1) * PHONE_GAP) / rows)
    : (gridSize.height - (rows - 1)) / rows;
  const colWidth = gridSize.width > 0 ? (gridSize.width - 8) / 7 : PHONE_FALLBACK_COL;

  // Cell heights are computed in px, so a wrapped title has to be measured up front
  const wrapTitles = wrapShiftTitles && variant !== "compare";
  const fonts = useMemo(
    () => ({
      title: cellFont(500, 11.5),
      time: cellMonoFont(400, 10.5),
      badge: cellMonoFont(400, 10),
      field: cellFont(600, 11),
    }),
    []
  );

  const desktopShiftLines = (shift: ShiftWithCalendar) => {
    if (!wrapTitles) return 1;
    const time = shift.isAllDay
      ? t("calendarView.allDayShort")
      : shift.startTime.slice(0, 5);
    const split = !shift.isAllDay && (shift.segments?.length ?? 0) > 0;
    const badge = signupBadgeLabel(shift, signupsEnabled(shift.calendarId));
    const width = desktopTitleWidth(
      colWidth,
      DESKTOP_RAIL,
      textWidth(time, fonts.time) + (split ? DESKTOP_SPLIT_ICON : 0),
      badge ? textWidth(badge, fonts.badge) + DESKTOP_BADGE_PAD : 0
    );
    return countWrappedLines(shift.title, fonts.title, width, MAX_TITLE_LINES);
  };

  const desktopExternalLines = (shift: ShiftWithCalendar) => {
    if (!wrapTitles) return 1;
    const time = shift.isAllDay
      ? t("calendarView.allDayShort")
      : shift.startTime.slice(0, 5);
    const width = desktopTitleWidth(
      colWidth,
      DESKTOP_SYNC_ICON,
      textWidth(time, fonts.time),
      0
    );
    return countWrappedLines(shift.title, fonts.title, width, MAX_TITLE_LINES);
  };

  const phoneFieldLines = (title: string) =>
    wrapTitles
      ? countWrappedLines(title, fonts.field, colWidth - PHONE_FIELD_PAD, MAX_TITLE_LINES)
      : 1;

  // One pass over the month instead of scanning every shift and note per cell
  const { maxShifts, maxExternalShifts, sortType, sortOrder, combinedSort } = layout;
  const dayContents = useMemo(() => {
    const month = currentDate.getMonth();
    return buildDayContents(
      calendarDays,
      shifts,
      notes,
      externalSyncs,
      { maxShifts, maxExternalShifts, sortType, sortOrder, combinedSort },
      // Leading and trailing days of other months stay empty
      (day) => day.getMonth() === month
    );
  }, [
    calendarDays,
    currentDate,
    shifts,
    notes,
    externalSyncs,
    maxShifts,
    maxExternalShifts,
    sortType,
    sortOrder,
    combinedSort,
  ]);

  /**
   * Day number, plus one counter per minimal-mode sync. Those carry no text, so
   * the header row has space for them and the cell body keeps its full budget.
   */
  const renderDesktopHead = (
    content: DayContent,
    day: Date,
    inMonth: boolean,
    today: boolean
  ) => (
    <span className="flex shrink-0 items-center gap-1">
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-medium leading-none",
          today ? TODAY_BADGE : inMonth ? "text-fg-body dark:text-fg-secondary" : "text-fg-faint"
        )}
      >
        {day.getDate()}
      </span>
      {content.layout.minimalGroups.length > 0 && (
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {content.layout.minimalGroups.map(({ sync, shifts: synced }) => (
            <MinimalSyncCounter key={sync.id} sync={sync} count={synced.length} />
          ))}
        </span>
      )}
    </span>
  );

  const renderDesktop = (content: DayContent) => {
    const { visible, hiddenCount, hiddenExternalCount } = content.layout;
    const entries: CellEntry[] = [
      ...visible.map((shift) => ({
        kind: shift.syncedFromExternal ? ("external" as const) : ("shift" as const),
        key: shift.id,
        shift,
      })),
      ...content.events.map((note) => ({ kind: "event" as const, key: note.id, note })),
      ...content.notes.map((note) => ({ kind: "note" as const, key: note.id, note })),
    ];
    const titleLines = entries.map((entry) =>
      entry.kind === "shift"
        ? desktopShiftLines(entry.shift)
        : entry.kind === "external"
          ? desktopExternalLines(entry.shift)
          : 1
    );
    const heights = entries.map((entry, index) => {
      const extraTitle = (titleLines[index] - 1) * DESKTOP_TITLE_LINE;
      if (entry.kind === "shift") {
        const noteLine = showShiftNotes && entry.shift.notes ? DESKTOP_SUB_LINE : 0;
        const fieldLine = hasVisibleCustomFields(entry.shift.customFields, customFieldDefinitions)
          ? DESKTOP_SUB_LINE
          : 0;
        return DESKTOP_ROW + extraTitle + noteLine + fieldLine;
      }
      if (entry.kind === "note") return DESKTOP_PLAIN_ROW;
      return DESKTOP_ROW + extraTitle;
    });
    const shown = fitCount(
      heights,
      hiddenCount,
      measured ? rowHeight - DESKTOP_CHROME : Infinity,
      DESKTOP_MAX_ROWS,
      DESKTOP_GAP,
      DESKTOP_OVERFLOW
    );

    let hiddenShifts = hiddenCount - hiddenExternalCount;
    let hiddenExternal = hiddenExternalCount;
    let hiddenEvents = 0;
    let hiddenNotes = 0;
    for (const entry of entries.slice(shown)) {
      if (entry.kind === "shift") hiddenShifts++;
      else if (entry.kind === "external") hiddenExternal++;
      else if (entry.kind === "event") hiddenEvents++;
      else hiddenNotes++;
    }
    const overflow = [
      hiddenShifts > 0 && t("calendarView.shiftCount", { count: hiddenShifts }),
      hiddenEvents > 0 && t("calendarView.eventCount", { count: hiddenEvents }),
      hiddenNotes > 0 && t("calendarView.notesCount", { count: hiddenNotes }),
      hiddenExternal > 0 && t("calendarView.externalCount", { count: hiddenExternal }),
    ].filter(Boolean);

    return (
      <>
        {entries.slice(0, shown).map((entry, index) => {
          const lines = titleLines[index] === 2 ? (2 as const) : (1 as const);
          switch (entry.kind) {
            case "shift":
              return (
                <ShiftChip
                  key={entry.key}
                  shift={entry.shift}
                  showNote={showShiftNotes}
                  signupsEnabled={signupsEnabled(entry.shift.calendarId)}
                  customFieldDefinitions={customFieldDefinitions}
                  titleLines={lines}
                />
              );
            case "external":
              return <ExternalShiftChip key={entry.key} shift={entry.shift} titleLines={lines} />;
            case "event":
              return <EventChip key={entry.key} note={entry.note} />;
            case "note":
              return <NoteLine key={entry.key} note={entry.note} />;
          }
        })}
        {overflow.length > 0 && (
          <span
            className="shrink-0 truncate pl-[5px] text-[11px] font-medium leading-[14px] text-brand-ink"
            title={`+ ${overflow.join(", ")}`}
          >
            + {overflow.join(", ")}
          </span>
        )}
      </>
    );
  };

  const renderPhoneBody = (content: DayContent) => {
    const { visible, hiddenCount, minimalGroups } = content.layout;
    const fields = [
      ...visible.map((shift) => ({ key: shift.id, color: shift.color, count: 1, shift })),
      ...minimalGroups.map(({ sync, shifts: synced }) => ({
        key: sync.id,
        color: sync.color,
        count: synced.length,
        shift: undefined,
      })),
    ];
    const fieldLines = fields.map((field) =>
      field.shift ? phoneFieldLines(field.shift.title) : 1
    );
    const shown = fitCount(
      fields.map((_, index) =>
        wrapTitles
          ? PHONE_FIELD_WRAP + (fieldLines[index] - 1) * PHONE_FIELD_WRAP_LINE
          : PHONE_FIELD
      ),
      hiddenCount,
      rowHeight - PHONE_CHROME,
      PHONE_MAX_FIELDS,
      PHONE_GAP,
      PHONE_COUNTER
    );
    const rest = fields.slice(shown).reduce((sum, field) => sum + field.count, hiddenCount);

    return (
      <span className="flex min-w-0 flex-col gap-[2px]">
        {fields.slice(0, shown).map((field) => (
          <span
            key={field.key}
            className={cn(
              "shift-field flex shrink-0 items-center gap-[2px] overflow-hidden rounded-[4px] px-1 text-[11px] font-semibold",
              wrapTitles
                ? "min-h-[20px] py-[3px] leading-[14px]"
                : "h-[19px] whitespace-nowrap leading-[19px]"
            )}
            style={shiftVars(field.color)}
          >
            {field.shift ? (
              wrapTitles ? (
                <span className="min-w-0 line-clamp-2 break-words">{field.shift.title}</span>
              ) : (
                // Cut hard at the field edge, no ellipsis: the first letters identify a shift
                field.shift.title
              )
            ) : (
              <>
                <RefreshCw className="size-2.5 shrink-0" />
                <span className="font-mono">{field.count}</span>
              </>
            )}
          </span>
        ))}
        {rest > 0 && (
          <span className="shrink-0 pl-1 font-mono text-[10px] font-semibold leading-3 text-brand-ink">
            +{rest}
          </span>
        )}
      </span>
    );
  };

  /** One mark per event, then one for notes; extra events give way to the note mark. */
  const renderPhoneMarks = (content: DayContent) => {
    const room = Math.min(
      PHONE_MAX_MARKS,
      Math.floor((colWidth - PHONE_HEAD_FIXED + PHONE_GAP) / (PHONE_MARK + PHONE_GAP))
    );
    const hasEvent = content.events.length > 0;
    const noteShown = content.notes.length > 0 && room >= (hasEvent ? 2 : 1);
    const eventCount = Math.min(content.events.length, room - (noteShown ? 1 : 0));
    if (eventCount + (noteShown ? 1 : 0) <= 0) return null;

    return (
      <span className="flex shrink-0 items-center gap-[2px]" aria-hidden>
        {content.events.slice(0, Math.max(0, eventCount)).map((event) => (
          <CalendarClock
            key={event.id}
            className="shift-icon size-2.5 shrink-0"
            style={shiftVars(event.color || undefined)}
          />
        ))}
        {noteShown && <StickyNote className="size-2.5 shrink-0 text-cell-note" />}
      </span>
    );
  };

  const renderCompare = (content: DayContent, day: Date, inMonth: boolean, today: boolean) => {
    const { visible, hiddenCount, minimalGroups } = content.layout;
    const { events, notes: plainNotes } = content;
    return (
      <>
        <div className="mb-1.5 flex w-full items-center justify-between gap-1.5">
          <span
            className={cn(
              "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[12.5px] font-medium leading-none",
              today
                ? TODAY_BADGE
                : inMonth
                  ? "text-fg-body"
                  : "text-fg-tertiary"
            )}
          >
            {day.getDate()}
          </span>
          {hiddenCount > 0 && (
            <span className="ml-auto rounded-[4px] bg-brand-soft px-1 py-px font-mono text-[10px] font-bold text-brand-ink">
              +{hiddenCount}
            </span>
          )}
          <span className="flex min-w-0 items-center gap-1">
            {plainNotes.length > 0 && (
              <StickyNote
                className="size-3.5 shrink-0 text-warning"
                aria-label={t("calendarView.hasNotes", { count: plainNotes.length })}
              />
            )}
            {events[0] && (
              <span
                className="shift-chip max-w-[88px] truncate rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold"
                style={shiftVars(events[0].color || "var(--brand)")}
                title={events.map((e) => e.note).join("\n")}
              >
                {events[0].note}
                {events.length > 1 && ` +${events.length - 1}`}
              </span>
            )}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-[3px]">
          {visible.map((shift) => (
            <span
              key={shift.id}
              className="flex min-w-0 items-center gap-1.5 rounded-sm bg-surface-sunken/70 px-1.5 py-[3px] text-[11.5px] text-fg-body"
              title={`${shift.title} · ${
                shift.isAllDay ? t("shift.allDayShift") : `${shift.startTime}–${shift.endTime}`
              }`}
            >
              <span
                className="shift-rail h-[13px] w-[3px] shrink-0 rounded-full"
                style={shiftVars(shift.color)}
              />
              <span className="min-w-0 flex-1 truncate">{shift.title}</span>
              <SignupBadge shift={shift} enabled={signupsEnabled(shift.calendarId)} />
            </span>
          ))}
          {minimalGroups.map(({ sync, shifts: syncShifts }) => (
            <span
              key={sync.id}
              className="shift-chip flex items-center gap-1.5 rounded-sm px-[7px] py-[3px] text-[11.5px] font-medium"
              style={shiftVars(sync.color)}
              title={sync.name}
            >
              <RefreshCw className="size-3 shrink-0" />
              <span className="truncate">
                {t("calendarView.externalCount", { count: syncShifts.length })}
              </span>
            </span>
          ))}
        </div>
      </>
    );
  };

  return (
    // On phones the grid may not shrink below its minimum rows, so the page scrolls instead
    <div className={cn("flex flex-1 flex-col", phone ? "relative isolate" : "min-h-0")}>
      {phone && highlightColor && highlightedWeekdays.length > 0 && (
        // Phone cells have no surface, so a highlighted weekday is one band behind the column
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-1 bottom-0 -z-10 grid grid-cols-7 px-1"
          style={{ "--highlight": highlightColor } as React.CSSProperties}
        >
          {highlightBands(highlightedWeekdays).map(({ start, span }) => (
            <span
              key={start}
              className="day-highlight rounded-[8px] [--highlight-tint:8%] dark:[--highlight-tint:10%]"
              style={{ gridColumn: `${start + 1} / span ${span}` }}
            />
          ))}
        </div>
      )}
      <div
        className={cn(
          "grid grid-cols-7",
          phone ? "px-1 pb-[5px]" : "border-b border-line",
          desktop && "px-[18px] pt-3.5",
          variant === "compare" && "px-4 pt-3"
        )}
      >
        {WEEKDAY_KEYS.map((key, index) =>
          phone ? (
            // Sits right above the left-aligned day number
            <div
              key={key}
              className="ml-1 w-[22px] text-center text-[10.5px] font-semibold uppercase tracking-[0.06em] text-cell-muted"
            >
              {t(`calendarView.weekdayShort.${key}`)}
            </div>
          ) : (
            <div
              key={key}
              className={cn(
                "px-2.5 pb-2 font-semibold uppercase tracking-[0.06em] text-fg-tertiary",
                desktop ? "text-[11.5px]" : "text-[11px]"
              )}
            >
              {desktop ? longWeekdays[index] : t(`calendarView.weekdayShort.${key}`)}
            </div>
          )
        )}
      </div>

      <div
        ref={gridRef}
        onTouchStart={swipeHandlers?.onTouchStart}
        onTouchEnd={swipeHandlers?.onTouchEnd}
        className={cn(
          "grid flex-1 grid-cols-7",
          phone
            ? "auto-rows-[minmax(84px,1fr)] gap-y-[2px] px-1"
            : "min-h-0 auto-rows-[minmax(0,1fr)] gap-px bg-line-grid",
          desktop && "mx-[18px]",
          variant === "compare" && "mx-4"
        )}
      >
        {calendarDays.map((day) => {
          const key = formatDateToLocal(day);
          const inMonth = day.getMonth() === currentDate.getMonth();
          const today = isToday(day);
          const selected = isSameDay(day, selectedDay);
          const weekend = day.getDay() === 0 || day.getDay() === 6;
          const highlighted =
            !phone && !!highlightColor && highlightedWeekdays.includes(day.getDay());
          const toggling = togglingDates.has(key);

          const content = dayContents.get(key)!;

          return (
            <button
              key={key}
              type="button"
              disabled={toggling}
              aria-pressed={selected}
              aria-label={day.toLocaleDateString()}
              {...dayPress(day)}
              style={
                highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined
              }
              className={cn(
                "relative flex min-h-0 min-w-0 select-none flex-col items-stretch overflow-hidden text-left outline-none transition-colors [-webkit-touch-callout:none]",
                // Phone cells have no surface and no lines; the fields carry the grid
                phone
                  ? "gap-[3px] rounded-[6px] px-[2px] pt-[5px] [contain:size]"
                  : cn(
                      weekend ? "bg-surface-weekend" : "bg-surface-cell",
                      "hover:bg-surface-panel",
                      selected && "shadow-[inset_0_0_0_1.5px_var(--brand-dot)]"
                    ),
                desktop && "gap-[3px] px-2 py-[7px]",
                variant === "compare" && "px-[9px] py-2",
                highlighted && "day-highlight",
                !inMonth && (phone ? "opacity-30" : desktop ? "opacity-35" : "opacity-45"),
                toggling && "cursor-wait opacity-60",
                "focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
              )}
            >
              {desktop && (
                <>
                  {renderDesktopHead(content, day, inMonth, today)}
                  {renderDesktop(content)}
                </>
              )}

              {phone && (
                <>
                  <span className="flex min-h-[22px] shrink-0 items-center gap-[3px] overflow-hidden pl-[2px] pr-px">
                    <span
                      className={cn(
                        "inline-flex size-[22px] shrink-0 items-center justify-center rounded-full font-mono text-[14px] leading-none",
                        today
                          ? TODAY_BADGE
                          : selected
                            ? "bg-cell-selected font-semibold text-fg-strong"
                            : !inMonth
                              ? "font-normal text-cell-outside-num"
                              : weekend
                                ? "font-[450] text-cell-weekend-num"
                                : "font-[450] text-fg-body"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {renderPhoneMarks(content)}
                  </span>
                  {renderPhoneBody(content)}
                </>
              )}

              {variant === "compare" && renderCompare(content, day, inMonth, today)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
