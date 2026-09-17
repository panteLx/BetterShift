"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, RefreshCw, StickyNote } from "lucide-react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { findNotesForDate } from "@/lib/event-utils";
import {
  DayLayoutOptions,
  DayShiftLayout,
  buildDayShiftLayout,
  formatSignupCapacityLabel,
  formatTimeRange,
  shiftVars,
} from "@/lib/shift-display";
import { cn } from "@/lib/utils";
import { useCalendars } from "@/hooks/useCalendars";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";

const LONG_PRESS_MS = 500;

// The filled day number of "today", shared by every grid and the list
export const TODAY_BADGE = "bg-brand font-semibold text-white dark:bg-brand-dot dark:text-[#0a1020]";

export interface DayContent {
  layout: DayShiftLayout;
  events: CalendarNote[];
  notes: CalendarNote[];
}

/** One pass over the shifts instead of scanning every shift and note per day. */
export function buildDayContents(
  days: Date[],
  shifts: ShiftWithCalendar[],
  notes: CalendarNote[],
  externalSyncs: ExternalSync[],
  layout: DayLayoutOptions,
  includeDay: (day: Date) => boolean
): Map<string, DayContent> {
  const shiftsByDay = new Map<string, ShiftWithCalendar[]>();
  for (const shift of shifts) {
    if (!shift.date) continue;
    const key = formatDateToLocal(shift.date as Date);
    const list = shiftsByDay.get(key);
    if (list) list.push(shift);
    else shiftsByDay.set(key, [shift]);
  }

  const contents = new Map<string, DayContent>();
  for (const day of days) {
    const key = formatDateToLocal(day);
    const included = includeDay(day);
    const dayNotes = included ? findNotesForDate(notes, day) : [];
    contents.set(key, {
      layout: buildDayShiftLayout(included ? (shiftsByDay.get(key) ?? []) : [], externalSyncs, layout),
      events: dayNotes.filter((n) => n.type === "event"),
      notes: dayNotes.filter((n) => n.type !== "event"),
    });
  }
  return contents;
}

/** Whether signups are on for a calendar; unknown calendars count as enabled. */
export function useSignupsEnabled(): (calendarId: string) => boolean {
  const { calendars } = useCalendars();
  const { isAuthEnabled } = useAuthFeatures();
  const byId = useMemo(
    () => new Map(calendars.map((c) => [c.id, isAuthEnabled && (c.signupsEnabled ?? true)])),
    [calendars, isAuthEnabled]
  );
  return (calendarId) => byId.get(calendarId) ?? true;
}

export interface DayPressHandlers {
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
}

/** Click, right-click and 500ms long-press for a day; the long press swallows the click that follows it. */
export function useDayPress(
  onDayClick: (day: Date) => void,
  onDayContextMenu?: (day: Date) => void
): (day: Date) => DayPressHandlers {
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

  return (day) => ({
    onClick: () => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onDayClick(day);
    },
    onContextMenu: (e) => {
      e.preventDefault();
      onDayContextMenu?.(day);
    },
    onTouchStart: () => {
      longPressed.current = false;
      if (!onDayContextMenu) return;
      pressTimer.current = setTimeout(() => {
        longPressed.current = true;
        onDayContextMenu(day);
      }, LONG_PRESS_MS);
    },
    onTouchEnd: cancelPress,
    onTouchMove: cancelPress,
  });
}

/** Compact "N" / "N/capacity" badge. */
export function SignupBadge({ shift, enabled }: { shift: ShiftWithCalendar; enabled: boolean }) {
  const t = useTranslations();
  if (!enabled) return null;
  const count = shift.signups?.length ?? 0;
  const capacity = shift.signupCapacity ?? null;
  if (count === 0 && capacity == null) return null;
  const label = capacity != null ? formatSignupCapacityLabel(t, count, capacity) : null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-[4px] px-1 font-mono text-[10px] leading-4",
        label?.isFull ? "bg-brand-soft text-brand-ink" : "bg-surface-sunken/70 text-fg-tertiary"
      )}
      title={label?.text}
    >
      {capacity != null ? `${count}/${capacity}` : count}
    </span>
  );
}

const CHIP =
  "shift-chip flex min-w-0 shrink-0 gap-1.5 rounded-[6px] py-0.5 pr-[7px] dark:[--shift-tint:14%]";
// Month cells cut titles to one line; week and list let them wrap
const lineClass = (wrap: boolean) => (wrap ? "block break-words" : "block truncate");

function ChipTime({ shift, full }: { shift: ShiftWithCalendar; full: boolean }) {
  const t = useTranslations();
  return (
    <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] leading-4 opacity-75">
      {shift.isAllDay
        ? t("calendarView.allDayShort")
        : full || shift.segments?.length
          ? formatTimeRange(shift)
          : shift.startTime.slice(0, 5)}
    </span>
  );
}

export function ShiftChip({
  shift,
  showNote,
  signupsEnabled,
  wrap = false,
}: {
  shift: ShiftWithCalendar;
  showNote: boolean;
  signupsEnabled: boolean;
  wrap?: boolean;
}) {
  return (
    <span
      className={cn(CHIP, "pl-[5px]")}
      style={shiftVars(shift.color)}
      title={`${shift.title}${shift.notes ? `\n${shift.notes}` : ""}`}
    >
      <span className="shift-rail w-[3px] shrink-0 self-stretch rounded-full" />
      <span className="min-w-0 flex-1">
        <span className={cn(lineClass(wrap), "text-[11.5px] font-medium leading-4")}>
          {shift.title}
        </span>
        {showNote && shift.notes && (
          <span className={cn(lineClass(wrap), "text-[10.5px] leading-[14px] opacity-75")}>
            {shift.notes}
          </span>
        )}
      </span>
      <SignupBadge shift={shift} enabled={signupsEnabled} />
      <ChipTime shift={shift} full={wrap} />
    </span>
  );
}

/** The sync icon takes the rail's place so imported entries stay recognisable. */
export function ExternalShiftChip({
  shift,
  wrap = false,
}: {
  shift: ShiftWithCalendar;
  wrap?: boolean;
}) {
  return (
    <span
      className={cn(CHIP, "pl-[5px]", wrap ? "items-start" : "items-center")}
      style={shiftVars(shift.color)}
      title={shift.title}
    >
      <RefreshCw className={cn("size-3 shrink-0", wrap && "mt-0.5")} />
      <span className={cn("min-w-0 flex-1 text-[11.5px] font-medium leading-4", lineClass(wrap))}>
        {shift.title}
      </span>
      <ChipTime shift={shift} full={wrap} />
    </span>
  );
}

export function EventChip({ note, wrap = false }: { note: CalendarNote; wrap?: boolean }) {
  return (
    <span
      className={cn(
        "flex min-w-0 shrink-0 gap-1.5 rounded-[6px] bg-cell-event px-[7px] shadow-[inset_0_0_0_1px_var(--cell-event-line)]",
        wrap ? "items-start py-0.5" : "h-5 items-center"
      )}
      title={note.note}
    >
      <CalendarClock
        className={cn("shift-icon size-3 shrink-0", wrap && "mt-0.5")}
        style={shiftVars(note.color || undefined)}
      />
      <span
        className={cn(
          "min-w-0 flex-1 text-[11.5px] font-medium text-cell-event-ink",
          wrap ? "break-words leading-4" : "truncate"
        )}
      >
        {note.note}
      </span>
    </span>
  );
}

export function NoteLine({ note, wrap = false }: { note: CalendarNote; wrap?: boolean }) {
  return (
    <span
      className={cn("flex min-w-0 shrink-0 gap-1.5 px-1", wrap ? "items-start py-px" : "h-[18px] items-center")}
      title={note.note}
    >
      <StickyNote className={cn("size-3 shrink-0 text-cell-note", wrap && "mt-0.5")} />
      <span
        className={cn(
          "min-w-0 flex-1 text-[11.5px] text-fg-body dark:text-fg-secondary",
          wrap ? "break-words leading-4" : "truncate"
        )}
      >
        {note.note}
      </span>
    </span>
  );
}

/** Count-only pill for an external sync in "minimal" display mode. */
export function MinimalSyncCounter({ sync, count }: { sync: ExternalSync; count: number }) {
  return (
    <span
      className="shift-chip flex shrink-0 items-center gap-1 rounded-[6px] px-[5px] py-0.5 dark:[--shift-tint:14%]"
      style={shiftVars(sync.color)}
      title={sync.name}
    >
      <RefreshCw className="size-3 shrink-0" />
      <span className="font-mono text-[11px] font-semibold leading-4">{count}</span>
    </span>
  );
}
