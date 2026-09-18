"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, RefreshCw, Split, StickyNote, UserPlus } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { useQuickSelfSignup, useShiftSignupPermission } from "@/hooks/useShiftSignups";

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

/** Quick self-assign; renders nothing when the viewer can't or already did. Shared with ShiftDetailRow. */
export function QuickSignupButton({
  shift,
  size = "md",
}: {
  shift: ShiftWithCalendar;
  /** "sm" fits a shift chip, "md" a full-height row like ShiftDetailRow */
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const { user: currentUser } = useAuth();
  const { canManageOwn } = useShiftSignupPermission(shift.calendarId);
  const { signUpForShift, isPending: signingUp } = useQuickSelfSignup();
  const signups = shift.signups ?? [];
  const capacity = shift.signupCapacity ?? null;
  const alreadySignedUp = !!currentUser && signups.some((s) => s.id === currentUser.id);
  const isFull = capacity != null && signups.length >= capacity;
  if (!canManageOwn || alreadySignedUp || isFull) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        signUpForShift(shift.id);
      }}
      disabled={signingUp}
      aria-label={t("shiftSignup.addSelf")}
      title={t("shiftSignup.addSelf")}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken disabled:opacity-40",
        size === "sm" ? "size-5" : "size-7"
      )}
    >
      <UserPlus className={size === "sm" ? "size-3.5" : "size-4"} />
    </button>
  );
}

const CHIP =
  "shift-chip flex min-w-0 shrink-0 gap-1.5 rounded-[6px] py-0.5 pr-[7px] dark:[--shift-tint:14%]";
// Month cells cut titles to one line; week and list let them wrap
const lineClass = (wrap: boolean) => (wrap ? "block break-words" : "block truncate");

function ChipTime({
  shift,
  full,
  stacked = false,
}: {
  shift: ShiftWithCalendar;
  full: boolean;
  /** Below the title instead of beside it, for wrap mode where the range no longer fits on one line */
  stacked?: boolean;
}) {
  const t = useTranslations();
  const text = shift.isAllDay
    ? t("calendarView.allDayShort")
    : full
      ? formatTimeRange(shift)
      : shift.startTime.slice(0, 5);

  if (stacked) {
    return (
      <span className="mt-0.5 block whitespace-normal break-words font-mono text-[10.5px] leading-4 opacity-75">
        {text}
      </span>
    );
  }

  // Compact mode only shows the start time, same as any other shift; the icon is what signals "split"
  const isSplit = !full && !shift.isAllDay && (shift.segments?.length ?? 0) > 0;
  return (
    <span className="flex min-w-0 max-w-[45%] shrink items-center gap-0.5">
      {isSplit && (
        <Split
          className="size-[9px] shrink-0 opacity-70"
          aria-hidden="true"
        />
      )}
      <span
        className="truncate font-mono text-[10.5px] leading-4 opacity-75"
        title={isSplit ? t("calendarView.splitShiftIndicator") : undefined}
      >
        {text}
      </span>
    </span>
  );
}

export function ShiftChip({
  shift,
  showNote,
  signupsEnabled,
  wrap = false,
  interactive = false,
}: {
  shift: ShiftWithCalendar;
  showNote: boolean;
  signupsEnabled: boolean;
  wrap?: boolean;
  /** Week view only: the cell is a div, not a button, so a nested signup button is valid here */
  interactive?: boolean;
}) {
  const title = `${shift.title}${shift.notes ? `\n${shift.notes}` : ""}`;

  // Wrap mode: the time no longer fits beside the title without breaking it per syllable,
  // so it moves below the title/note; only the signup badge stays on the title's row.
  if (wrap) {
    return (
      <span className={cn(CHIP, "pl-[5px]")} style={shiftVars(shift.color)} title={title}>
        <span className="shift-rail w-[3px] shrink-0 self-stretch rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            <span className={cn(lineClass(wrap), "min-w-0 flex-1 text-[11.5px] font-medium leading-4")}>
              {shift.title}
            </span>
            <SignupBadge shift={shift} enabled={signupsEnabled} />
            {interactive && <QuickSignupButton shift={shift} />}
          </span>
          {showNote && shift.notes && (
            <span className={cn(lineClass(wrap), "text-[10.5px] leading-[14px] opacity-75")}>
              {shift.notes}
            </span>
          )}
          <ChipTime shift={shift} full={wrap} stacked />
        </span>
      </span>
    );
  }

  return (
    <span className={cn(CHIP, "pl-[5px]")} style={shiftVars(shift.color)} title={title}>
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
      {interactive && <QuickSignupButton shift={shift} />}
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
  // Wrap mode: title column stacks the time below itself instead of beside it
  if (wrap) {
    return (
      <span className={cn(CHIP, "pl-[5px] items-start")} style={shiftVars(shift.color)} title={shift.title}>
        <RefreshCw className="mt-0.5 size-3 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className={cn(lineClass(wrap), "text-[11.5px] font-medium leading-4")}>
            {shift.title}
          </span>
          <ChipTime shift={shift} full={wrap} stacked />
        </span>
      </span>
    );
  }

  return (
    <span className={cn(CHIP, "pl-[5px] items-center")} style={shiftVars(shift.color)} title={shift.title}>
      <RefreshCw className="size-3 shrink-0" />
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
