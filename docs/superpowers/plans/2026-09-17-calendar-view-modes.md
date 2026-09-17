# Calendar View Modes (Month / Week / List) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a week view and a list view next to the month grid, switched through a Month/Week/List control in the header (issues #184, #185, #186).

**Architecture:** One per-device mode (`localStorage`) owned by `app/page.tsx`; `currentDate` stays the single date anchor and the stepper steps by month or week. `CalendarWorkspace` renders `MonthGrid`, a new `WeekGrid` or a new `ShiftListView` from the same already-loaded data. Cell entry renderers move out of `MonthGrid` into a shared module so the week view reuses them. No schema, API or fetching change.

**Tech Stack:** Next.js 16 (App Router), React 19.3 (`useSyncExternalStore`, `useEffectEvent`), date-fns 4, next-intl, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-17-calendar-view-modes-design.md`

## Global Constraints

- Branch `feat/calendar-view-modes` (already created from `origin/main`). Conventional Commits; **no Claude attribution** in commit messages.
- Code comments English, one or two lines, only where a reader would otherwise break something. UI strings live in `messages/*.json`.
- i18n: add keys to `messages/de.json` first, then mirror into `en`, `es`, `fr`, `it`, `cs`. `npm run i18n` fails on keys that are missing **or unused**, so a task adds exactly the keys its code references and removes keys it orphans.
- Dates are local `YYYY-MM-DD`; use `formatDateToLocal` / `parseLocalDate` from `lib/date-utils.ts`, never `toISOString()`.
- Weeks start on Monday: always `{ weekStartsOn: 1 }`.
- `components/ui/*` are generated shadcn primitives — do not edit. `components/segmented-control.tsx` is a project component and may be edited.
- `buildDayShiftLayout` treats `undefined` (not `null`) as "no per-day cap".
- There is no unit-test framework. The gate per task is `npx tsc --noEmit && npm run lint && npm run i18n`; the Bash tool's Node version warning is a known non-issue.
- Compare mode (`components/compare-workspace.tsx`) must keep working unchanged: `MonthStepper` / `MonthArrows` defaults stay month-stepping.

## File Structure

| File | Responsibility |
|---|---|
| `hooks/useCalendarViewMode.ts` (new) | persisted mode + list of modes that have a surface |
| `lib/calendar-utils.ts` | `getWeekDays`, `getMonthDays` next to `getCalendarDays` |
| `lib/date-utils.ts` | `formatWeekRange`, `formatPeriodCaption` |
| `components/segmented-control.tsx` | option label may be a node, optional `ariaLabel` |
| `components/view-mode-switcher.tsx` (new) | the Month/Week/List control, text or icon variant |
| `components/app-header.tsx` | `step` on stepper/arrows, switcher in the desktop row |
| `components/day-cell-entries.tsx` (new) | shared chips, `useDayPress`, `buildDayContents` |
| `components/month-grid.tsx` | consumes the shared module, otherwise unchanged |
| `components/week-grid.tsx` (new) | week view, desktop columns / phone rows |
| `components/shift-list-view.tsx` (new) | list view with toolbar, week groups, day rows |
| `components/day-detail.tsx` | `ShiftDetailRow` gets `fullTitle` |
| `components/mobile-day-sheet.tsx` | footer list variant (next shift), `onShowList` |
| `components/day-inspector.tsx` | `DayActions.onShowList?` replaces `onOpenMonthShifts` |
| `components/calendar-workspace.tsx` | picks the surface by `viewMode`, mobile title row |
| `components/month-dialogs.tsx`, `components/dialog-manager.tsx`, `hooks/useDialogStates.ts` | `MonthShiftsDialog` removed |
| `app/page.tsx` | mode state, mode-aware date handlers, wiring |

---

### Task 1: Mode state, week-aware stepper and the switcher (#186)

**Files:**
- Create: `hooks/useCalendarViewMode.ts`, `components/view-mode-switcher.tsx`
- Modify: `lib/calendar-utils.ts`, `lib/date-utils.ts`, `components/segmented-control.tsx`, `components/app-header.tsx`, `components/calendar-workspace.tsx`, `app/page.tsx`, `messages/{de,en,es,fr,it,cs}.json`

**Interfaces:**
- Produces:
  - `type CalendarViewMode = "month" | "week" | "list"`; `AVAILABLE_VIEW_MODES: readonly CalendarViewMode[]`; `useCalendarViewMode(): readonly [CalendarViewMode, (mode: CalendarViewMode) => void]`
  - `getWeekDays(date: Date): Date[]`, `getMonthDays(date: Date): Date[]`
  - `type PeriodStep = "month" | "week"`; `formatWeekRange(start: Date, end: Date, locale: string, withYear?: boolean): string`; `formatPeriodCaption(date: Date, step: PeriodStep, locale: string, options?: { compact?: boolean }): string`
  - `MonthStepper` / `MonthArrows` prop `step?: PeriodStep`
  - `<ViewModeSwitcher value onChange variant="text" | "icon" />`
  - `CalendarWorkspace` props `viewMode: CalendarViewMode`, `onViewModeChange: (mode: CalendarViewMode) => void`
  - `AppHeader` props `viewMode?: CalendarViewMode`, `onViewModeChange?: (mode: CalendarViewMode) => void`

- [ ] **Step 1: `lib/calendar-utils.ts` — add the two day generators below `getCalendarDays`**

```ts
export function getWeekDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  });
}

export function getMonthDays(date: Date): Date[] {
  return eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });
}
```

- [ ] **Step 2: `lib/date-utils.ts` — add the caption helpers after `formatLongDate`**

Add imports at the top of the file: `import { endOfWeek, format, startOfWeek } from "date-fns";` and `import { getDateLocale } from "@/lib/locales";`.

```ts
export type PeriodStep = "month" | "week";

const weekRangeFormatters = new Map<string, Intl.DateTimeFormat>();

/** "8.–14. Sep. 2026"; formatRange collapses the parts both ends share. */
export function formatWeekRange(start: Date, end: Date, locale: string, withYear = true): string {
  const key = `${locale}|${withYear}`;
  let formatter = weekRangeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
    });
    weekRangeFormatters.set(key, formatter);
  }
  return formatter.formatRange(start, end);
}

/** Stepper and title caption: the month name, or the Monday–Sunday range around `date`. */
export function formatPeriodCaption(
  date: Date,
  step: PeriodStep,
  locale: string,
  { compact = false }: { compact?: boolean } = {}
): string {
  if (step === "month") return format(date, "LLLL yyyy", { locale: getDateLocale(locale) });
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  // Compact drops the year while the whole week lies in the current one
  const thisYear = new Date().getFullYear();
  const withYear =
    !compact || start.getFullYear() !== thisYear || end.getFullYear() !== thisYear;
  return formatWeekRange(start, end, locale, withYear);
}
```

Before adding the `getDateLocale` import, run `grep -n "date-utils" lib/locales.ts`; if `lib/locales.ts` imports from `lib/date-utils.ts` (it should not), put both helpers into `lib/calendar-utils.ts` instead and adjust every import in this plan accordingly.

- [ ] **Step 3: Create `hooks/useCalendarViewMode.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CalendarViewMode = "month" | "week" | "list";

/** Modes that have a surface; the switcher offers exactly these. */
export const AVAILABLE_VIEW_MODES: readonly CalendarViewMode[] = ["month"];

// Per-device like the view-setting keys in useViewSettings.ts, never synced to the account
const STORAGE_KEY = "calendar-view-mode";
const CHANGE_EVENT = "calendar-view-mode-change";

// Keeps the choice for the session when storage is unavailable (private mode)
let memory: CalendarViewMode | null = null;

function readMode(): CalendarViewMode {
  if (memory) return memory;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as CalendarViewMode | null;
    return stored && AVAILABLE_VIEW_MODES.includes(stored) ? stored : "month";
  } catch {
    return "month";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useCalendarViewMode() {
  // The server snapshot keeps the first client render identical to SSR
  const mode = useSyncExternalStore(subscribe, readMode, () => "month" as const);
  const setMode = useCallback((next: CalendarViewMode) => {
    memory = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The in-memory value above still applies
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode] as const;
}
```

- [ ] **Step 4: `components/segmented-control.tsx` — allow node labels**

Change the options type and the button:

```tsx
  options: { value: T; label: React.ReactNode; ariaLabel?: string; badge?: React.ReactNode }[];
```

```tsx
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={option.ariaLabel}
            title={option.ariaLabel}
            onClick={() => onChange(option.value)}
```

Everything else in the file stays. Existing call sites pass strings and keep compiling.

- [ ] **Step 5: Create `components/view-mode-switcher.tsx`**

```tsx
"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, CalendarRange, List } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { AVAILABLE_VIEW_MODES, CalendarViewMode } from "@/hooks/useCalendarViewMode";

const ICONS = { month: CalendarDays, week: CalendarRange, list: List } as const;

export function ViewModeSwitcher({
  value,
  onChange,
  variant,
}: {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
  /** "icon" is the phone title row, where three words do not fit */
  variant: "text" | "icon";
}) {
  const t = useTranslations();
  if (AVAILABLE_VIEW_MODES.length < 2) return null;

  const labels: Record<CalendarViewMode, string> = {
    month: t("calendarView.viewMonth"),
    week: t("calendarView.viewWeek"),
    list: t("calendarView.viewList"),
  };

  return (
    <SegmentedControl<CalendarViewMode>
      label={t("calendarView.viewMode")}
      value={value}
      onChange={onChange}
      // Icon track: 36px per segment plus the 6px track padding
      className={
        variant === "icon"
          ? AVAILABLE_VIEW_MODES.length === 3
            ? "w-[114px] shrink-0"
            : "w-[78px] shrink-0"
          : "shrink-0"
      }
      options={AVAILABLE_VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode];
        return variant === "icon"
          ? { value: mode, label: <Icon className="size-4" />, ariaLabel: labels[mode] }
          : { value: mode, label: <span className="px-3">{labels[mode]}</span> };
      })}
    />
  );
}
```

- [ ] **Step 6: `components/app-header.tsx` — `step` on both steppers, switcher in the desktop row**

Imports: replace the date-fns import with `import { addMonths, addWeeks, getISOWeek } from "date-fns";` (drop `format`, `subMonths`; drop the `getDateLocale` import if nothing else in the file uses it — `AppHeader` does not), add `import { formatPeriodCaption, PeriodStep } from "@/lib/date-utils";`, `import { ViewModeSwitcher } from "@/components/view-mode-switcher";`, `import { CalendarViewMode } from "@/hooks/useCalendarViewMode";`.

Add one module-level helper above `MonthArrows`:

```ts
function stepDate(date: Date, step: PeriodStep, direction: 1 | -1): Date {
  return step === "week" ? addWeeks(date, direction) : addMonths(date, direction);
}
```

`MonthArrows`: add `step = "month"` to the props (`step?: PeriodStep`), and replace the two handlers/labels:

```tsx
        onClick={() => onDateChange(stepDate(currentDate, step, -1))}
        aria-label={t(step === "week" ? "calendarView.previousWeek" : "calendarView.previousMonth")}
```

```tsx
        onClick={() => onDateChange(stepDate(currentDate, step, 1))}
        aria-label={t(step === "week" ? "calendarView.nextWeek" : "calendarView.nextMonth")}
```

`MonthStepper`: same `step` prop and the same two handler/label replacements; replace the caption span with:

```tsx
      <span
        className={cn(
          "text-center text-[15px] font-semibold text-fg-strong",
          step === "week" ? "min-w-[232px]" : "min-w-[150px]"
        )}
      >
        {formatPeriodCaption(currentDate, step, locale)}
        {step === "week" && (
          <span className="ml-2 font-mono text-[12px] font-medium text-fg-tertiary">
            {t("calendarView.calendarWeek", { week: getISOWeek(currentDate) })}
          </span>
        )}
      </span>
```

`AppHeaderProps`: add

```ts
  /** Absent in contexts without view modes; the switcher is then not rendered */
  viewMode?: CalendarViewMode;
  onViewModeChange?: (mode: CalendarViewMode) => void;
```

Destructure both in `AppHeader`. In the desktop row replace the `<MonthStepper …/>` line with:

```tsx
          <MonthStepper
            currentDate={currentDate}
            onDateChange={onDateChange}
            step={viewMode === "week" ? "week" : "month"}
          />
          {viewMode && onViewModeChange && (
            <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} variant="text" />
          )}
```

Note: the i18n checker greps literal keys. `t(step === "week" ? "calendarView.previousWeek" : "calendarView.previousMonth")` contains both literals, which is what it needs — verify with `npm run i18n` in Step 10; if it reports the keys as unused, split into two `t()` calls selected by a ternary on the results.

- [ ] **Step 7: `components/calendar-workspace.tsx` — props and the mobile title row**

Imports: add `import { ViewModeSwitcher } from "@/components/view-mode-switcher";`, `import { CalendarViewMode } from "@/hooks/useCalendarViewMode";`, `import { formatPeriodCaption } from "@/lib/date-utils";`. Remove `format` from the date-fns import and the `getDateLocale` import plus the `const dateLocale = …` line if nothing else uses them after this step.

Props interface and destructuring: add `viewMode: CalendarViewMode;` and `onViewModeChange: (mode: CalendarViewMode) => void;`.

Below the `stampingEnabled` line add `const step = viewMode === "week" ? "week" : "month";`.

Replace the mobile title row (`<div className="flex items-center justify-between gap-2 px-3.5 pb-[9px] pt-3">…</div>`) with:

```tsx
        <div className="flex items-center gap-2 px-3.5 pb-[9px] pt-3">
          <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.015em] text-fg-strong">
            {formatPeriodCaption(currentDate, step, locale, { compact: true })}
          </h1>
          <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} variant="icon" />
          {isOnline ? (
            <MonthArrows currentDate={currentDate} onDateChange={onDateChange} step={step} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 font-semibold"
              onClick={() => queryClient.refetchQueries()}
            >
              <RefreshCw className="size-4" />
              {t("calendarView.retry")}
            </Button>
          )}
        </div>
```

- [ ] **Step 8: `app/page.tsx` — own the mode, make the date handlers mode-aware**

Imports: change the date-fns import to `import { addDays, isSameMonth, isSameWeek, startOfWeek } from "date-fns";`, change the calendar-utils import to `import { getCalendarDays, getMonthDays, getWeekDays } from "@/lib/calendar-utils";`, add `import { CalendarViewMode, useCalendarViewMode } from "@/hooks/useCalendarViewMode";`.

Directly after the `useCompareMode({...})` call:

```ts
  const [storedViewMode, setViewMode] = useCalendarViewMode();
  // Compare mode shares one month grid, whatever this device last used
  const viewMode: CalendarViewMode = isCompareMode ? "month" : storedViewMode;
```

Replace `handleDateChange` with:

```ts
  // Navigation keeps the selection inside the visible period
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (viewMode === "week") {
      if (!isSameWeek(selectedDay, date, { weekStartsOn: 1 })) {
        const now = new Date();
        selectDay(
          isSameWeek(now, date, { weekStartsOn: 1 })
            ? now
            : addDays(startOfWeek(date, { weekStartsOn: 1 }), (selectedDay.getDay() + 6) % 7)
        );
      }
      return;
    }
    if (!isSameMonth(selectedDay, date)) {
      selectDay(isSameMonth(new Date(), date) ? new Date() : new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  // Switching the mode never moves the visible month; week anchors on the focused day
  const handleViewModeChange = (mode: CalendarViewMode) => {
    if (mode === "week" && isSameMonth(selectedDay, currentDate)) setCurrentDate(selectedDay);
    setViewMode(mode);
  };
```

Replace the `calendarDays` memo:

```ts
  const calendarDays = useMemo(
    () =>
      viewMode === "week"
        ? getWeekDays(currentDate)
        : viewMode === "list"
          ? getMonthDays(currentDate)
          : getCalendarDays(currentDate),
    [currentDate, viewMode]
  );
```

Pass `viewMode={viewMode}` and `onViewModeChange={handleViewModeChange}` to both `<AppHeader>` and `<CalendarWorkspace>`.

- [ ] **Step 9: i18n keys**

In `messages/de.json` under `calendarView`, right after `"nextMonth"`:

```json
    "previousWeek": "Vorherige Woche",
    "nextWeek": "Nächste Woche",
    "viewMode": "Ansicht",
    "viewMonth": "Monat",
    "viewWeek": "Woche",
    "viewList": "Liste",
```

Mirror at the same position:

| key | en | es | fr | it | cs |
|---|---|---|---|---|---|
| previousWeek | Previous week | Semana anterior | Semaine précédente | Settimana precedente | Předchozí týden |
| nextWeek | Next week | Semana siguiente | Semaine suivante | Settimana successiva | Další týden |
| viewMode | View | Vista | Vue | Vista | Zobrazení |
| viewMonth | Month | Mes | Mois | Mese | Měsíc |
| viewWeek | Week | Semana | Semaine | Settimana | Týden |
| viewList | List | Lista | Liste | Elenco | Seznam |

- [ ] **Step 10: Gate**

Run: `npx tsc --noEmit && npm run lint && npm run i18n`
Expected: all three exit 0. The switcher is not visible yet (`AVAILABLE_VIEW_MODES` has one entry) and the app behaves exactly as before.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(ui): add month/week/list view mode state and switcher (#186)"
```

---

### Task 2: Extract the shared day-cell renderers from `MonthGrid`

Pure refactor: the month view must look and behave exactly as before.

**Files:**
- Create: `components/day-cell-entries.tsx`
- Modify: `components/month-grid.tsx`

**Interfaces:**
- Produces (all from `@/components/day-cell-entries`):
  - `TODAY_BADGE: string`
  - `interface DayContent { layout: DayShiftLayout; events: CalendarNote[]; notes: CalendarNote[] }`
  - `buildDayContents(days: Date[], shifts: ShiftWithCalendar[], notes: CalendarNote[], externalSyncs: ExternalSync[], layout: DayLayoutOptions, includeDay: (day: Date) => boolean): Map<string, DayContent>` — keyed by `formatDateToLocal(day)`
  - `useSignupsEnabled(): (calendarId: string) => boolean`
  - `useDayPress(onDayClick: (day: Date) => void, onDayContextMenu?: (day: Date) => void): (day: Date) => DayPressHandlers` where `DayPressHandlers = { onClick; onContextMenu; onTouchStart; onTouchEnd; onTouchMove }`
  - `<SignupBadge shift enabled />`, `<ShiftChip shift showNote signupsEnabled wrap? />`, `<ExternalShiftChip shift wrap? />`, `<EventChip note wrap? />`, `<NoteLine note wrap? />`, `<MinimalSyncCounter sync count />`

- [ ] **Step 1: Create `components/day-cell-entries.tsx`**

```tsx
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
```

The non-wrap class strings are copied from `month-grid.tsx` — compare them against the current file while extracting and keep the file's strings if they differ from the ones above.

- [ ] **Step 2: Rewire `components/month-grid.tsx`**

- Delete from the file: `LONG_PRESS_MS`, `TODAY_BADGE`, the `DayContent` interface, `signupsEnabledById`, `signupBadge`, `pressTimer`, `longPressed`, the cleanup `useEffect`, `cancelPress`, and the `useCalendars` / `useAuthFeatures` / `findNotesForDate` / `buildDayShiftLayout` / `formatTimeRange` / `CalendarClock` / `StickyNote` imports that become unused (the phone marks and the compare cell still use `CalendarClock`, `StickyNote`, `RefreshCw` — keep whatever is still referenced).
- Import from the new module: `DayContent, EventChip, ExternalShiftChip, MinimalSyncCounter, NoteLine, ShiftChip, SignupBadge, TODAY_BADGE, buildDayContents, useDayPress, useSignupsEnabled`.
- Add near the top of the component:

```ts
  const signupsEnabled = useSignupsEnabled();
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
```

- Replace the `dayContents` memo body:

```ts
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
  }, [calendarDays, currentDate, shifts, notes, externalSyncs, maxShifts, maxExternalShifts, sortType, sortOrder, combinedSort]);
```

- In `renderDesktopHead` replace the inline minimal-group span with `<MinimalSyncCounter key={sync.id} sync={sync} count={synced.length} />`.
- In `renderDesktop` delete the local `chip` and `time` helpers and replace the `switch` body with:

```tsx
          switch (entry.kind) {
            case "shift":
              return (
                <ShiftChip
                  key={entry.key}
                  shift={entry.shift}
                  showNote={showShiftNotes}
                  signupsEnabled={signupsEnabled(entry.shift.calendarId)}
                />
              );
            case "external":
              return <ExternalShiftChip key={entry.key} shift={entry.shift} />;
            case "event":
              return <EventChip key={entry.key} note={entry.note} />;
            case "note":
              return <NoteLine key={entry.key} note={entry.note} />;
          }
```

- In `renderCompare` replace `{signupBadge(shift)}` with `<SignupBadge shift={shift} enabled={signupsEnabled(shift.calendarId)} />`.
- On the day `<button>` replace the five inline handlers (`onClick`, `onContextMenu`, `onTouchStart`, `onTouchEnd`, `onTouchMove`) with `{...dayPress(day)}`.

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit && npm run lint && npm run i18n`
Expected: exit 0, no unused-import warnings in `month-grid.tsx`.

- [ ] **Step 4: Visual regression check**

Start `npm run dev`, open the app at 1440×900 and at 390×844 with a calendar that has shifts, a note and an event. Month cells, chips, signup badges, the today badge, stamping a preset on a day, right-click → notes dialog must be unchanged compared to `main`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(ui): share the day-cell renderers between calendar views"
```

---

### Task 3: Week view (#184)

**Files:**
- Create: `components/week-grid.tsx`
- Modify: `hooks/useCalendarViewMode.ts`, `components/calendar-workspace.tsx`

**Interfaces:**
- Consumes: everything Task 2 produces; `getWeekDays` days arrive as `calendarDays` from the page (Task 1).
- Produces: `<WeekGrid variant days selectedDay shifts notes externalSyncs togglingDates layout showShiftNotes? highlightedWeekdays? highlightColor? onDayClick onDayContextMenu? />`

- [ ] **Step 1: Create `components/week-grid.tsx`**

```tsx
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
}: WeekGridProps) {
  const t = useTranslations();
  const locale = useLocale();
  const signupsEnabled = useSignupsEnabled();
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
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

        return (
          <button
            key={key}
            type="button"
            disabled={toggling}
            aria-pressed={selected}
            aria-label={day.toLocaleDateString()}
            {...dayPress(day)}
            style={highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined}
            className={cn(
              "relative min-w-0 select-none text-left outline-none transition-colors [-webkit-touch-callout:none]",
              "focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
              desktop
                ? cn(
                    "flex min-h-0 flex-col items-stretch gap-[3px] overflow-y-auto px-2 pb-2",
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
                {/* Sticky so the date stays readable while a full day scrolls */}
                <span className="sticky top-0 z-10 -mx-2 flex shrink-0 items-center gap-1.5 bg-inherit px-2 pb-1.5 pt-2">
                  <span
                    className={cn(
                      "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-1 font-mono text-[12.5px] font-medium leading-none",
                      today ? TODAY_BADGE : "text-fg-body dark:text-fg-secondary"
                    )}
                  >
                    {day.getDate()}
                  </span>
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
                <span className="flex w-10 shrink-0 flex-col items-center gap-0.5 pt-0.5">
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
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 border-b border-line pb-2.5">
                  {counters.length > 0 && <span className="flex flex-wrap gap-1">{counters}</span>}
                  {renderEntries(content)}
                  {isEmpty(content) && (
                    <span className="py-1 text-[12.5px] text-fg-faint">{t("calendarView.dayFree")}</span>
                  )}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

`bg-inherit` on the sticky head only works if the button's background is set by a class on the button itself (it is). The `day-highlight` class sets its own background; check in the browser that the sticky head of a highlighted column does not show a mismatched strip — if it does, drop `bg-inherit` in favour of repeating the weekend/cell/highlight classes on the head.

- [ ] **Step 2: `components/calendar-workspace.tsx` — pick the surface**

Import `WeekGrid`. Replace `const grid = (<MonthGrid … />);` with:

```tsx
  const variant = desktop ? "desktop" : "phone";
  const surface =
    viewMode === "week" ? (
      <WeekGrid
        variant={variant}
        days={calendarDays}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        layout={layout}
        showShiftNotes={showShiftNotes}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        onDayClick={onDayClick}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
      />
    ) : (
      <MonthGrid
        variant={variant}
        calendarDays={calendarDays}
        currentDate={currentDate}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        layout={layout}
        showShiftNotes={showShiftNotes}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        onDayClick={onDayClick}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
      />
    );
```

and replace both `{grid}` usages with `{surface}`. The desktop wrapper uses `[&>div]:opacity-60` while offline, which also matches `WeekGrid`'s root `div` — no change needed.

- [ ] **Step 3: Enable the mode**

In `hooks/useCalendarViewMode.ts`: `export const AVAILABLE_VIEW_MODES: readonly CalendarViewMode[] = ["month", "week"];`

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit && npm run lint && npm run i18n`
Expected: exit 0.

- [ ] **Step 5: Browser check (1440×900 and 390×844)**

- The switcher now shows Month/Week; switching to Week keeps the month, shows the week of the selected day, caption reads like "14.–20. Sep. 2026 · KW 38".
- Arrows step one week; step across a month boundary (caption collapses to two months) and across New Year.
- A week straddling two months shows full content on all seven days.
- Click selects (inspector / day sheet follows), armed preset stamps and un-stamps, right-click / long-press opens notes.
- Month → Week → Month → Week returns to the same week. Reload restores Week.
- Compare mode still shows the month grid and steps by month.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add week view (#184)"
```

---

### Task 4: List view (#185)

**Files:**
- Create: `components/shift-list-view.tsx`
- Modify: `components/day-detail.tsx`, `components/mobile-day-sheet.tsx`, `components/calendar-workspace.tsx`, `app/page.tsx`, `hooks/useCalendarViewMode.ts`, `messages/*.json`

**Interfaces:**
- Consumes: `buildDayContents`, `useDayPress`, `EventChip`, `NoteLine`, `MinimalSyncCounter`, `TODAY_BADGE` (Task 2); `formatWeekRange` (Task 1); `getMonthDays` days arrive as `calendarDays`.
- Produces:
  - `ShiftDetailRow` prop `fullTitle?: boolean`
  - `ListSort = { type: ShiftSortType; order: ShiftSortOrder; locked: boolean; onChange: (patch: { sortType?: ShiftSortType; sortOrder?: ShiftSortOrder }) => void }`
  - `<ShiftListView …/>` (props below)
  - `CalendarWorkspace` props `listSort: ListSort`, `onSelectDay: (day: Date) => void`
  - `MobileDayFooter` prop `list?: { nextShift: ShiftWithCalendar | null; onJump: () => void }`

- [ ] **Step 1: `components/day-detail.tsx` — `fullTitle` on `ShiftDetailRow`**

Add `/** List view: title and note wrap instead of truncating */ fullTitle?: boolean;` to `ShiftDetailRowProps`, destructure `fullTitle = false`, and change the two lines:

```tsx
        <div className={cn("text-[13.5px] font-semibold text-fg-strong", fullTitle ? "break-words" : "truncate")}>
          {shift.title}
        </div>
```

```tsx
          <div className={cn("mt-1 text-xs text-fg-secondary", fullTitle ? "whitespace-pre-line break-words" : "line-clamp-2")}>
            {shift.notes}
          </div>
```

- [ ] **Step 2: Create `components/shift-list-view.tsx`**

```tsx
"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { endOfWeek, getISOWeek, isSameDay, isSameWeek, isToday, startOfWeek } from "date-fns";
import { ArrowDownUp, Lock, Plus, RefreshCw, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal, formatWeekRange } from "@/lib/date-utils";
import {
  ShiftSortOrder,
  ShiftSortType,
  formatHours,
  getShiftMinutes,
  shiftVars,
} from "@/lib/shift-display";
import { cn } from "@/lib/utils";
import { ShiftDetailRow } from "@/components/day-detail";
import {
  EventChip,
  MinimalSyncCounter,
  NoteLine,
  TODAY_BADGE,
  buildDayContents,
  useDayPress,
} from "@/components/day-cell-entries";

export interface ListSort {
  type: ShiftSortType;
  order: ShiftSortOrder;
  /** The calendar pins its own view, so the personal sort would not apply */
  locked: boolean;
  onChange: (patch: { sortType?: ShiftSortType; sortOrder?: ShiftSortOrder }) => void;
}

interface ShiftListViewProps {
  variant: "desktop" | "phone";
  /** Every day of the visible month, so stamping by day click works on empty days too */
  days: Date[];
  selectedDay: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  presets: ShiftPreset[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  sort: ListSort;
  combinedSort: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  /** A preset is armed: clicking a shift row stamps the day instead of opening the shift */
  stampArmed: boolean;
  canAddShift: boolean;
  onAddShift: () => void;
  canEditShift: (shift: ShiftWithCalendar) => boolean;
  canDeleteShift: (shift: ShiftWithCalendar) => boolean;
  onEditShift: (shift: ShiftWithCalendar) => void;
  onDeleteShift: (shift: ShiftWithCalendar) => void;
  onDayClick: (date: Date) => void;
  onDayContextMenu?: (date: Date) => void;
  /** Bump `nonce` to scroll to `key` again */
  scrollTarget?: { key: string; nonce: number } | null;
}

const NO_PRESET = "none";
const WEEK = { weekStartsOn: 1 } as const;

/** Filter chip a shift falls under: its sync, its preset, or "without preset". */
function chipKeyOf(shift: ShiftWithCalendar, presetIds: Set<string>): string {
  if (shift.syncedFromExternal && shift.externalSyncId) return `sync:${shift.externalSyncId}`;
  return shift.presetId && presetIds.has(shift.presetId) ? `preset:${shift.presetId}` : NO_PRESET;
}

export function ShiftListView({
  variant,
  days,
  selectedDay,
  shifts,
  notes,
  presets,
  externalSyncs,
  togglingDates,
  sort,
  combinedSort,
  highlightedWeekdays = [],
  highlightColor,
  stampArmed,
  canAddShift,
  onAddShift,
  canEditShift,
  canDeleteShift,
  onEditShift,
  onDeleteShift,
  onDayClick,
  onDayContextMenu,
  scrollTarget,
}: ShiftListViewProps) {
  const t = useTranslations();
  const locale = useLocale();
  const desktop = variant === "desktop";
  const dayPress = useDayPress(onDayClick, onDayContextMenu);
  const [query, setQuery] = useState("");
  const [activeChips, setActiveChips] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const weekdayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const presetIds = useMemo(() => new Set(presets.map((p) => p.id)), [presets]);

  // "minimal" syncs are listed in full here: the list is where details live
  const listSyncs = useMemo(
    () => externalSyncs.map((sync) => ({ ...sync, displayMode: "normal" as const })),
    [externalSyncs]
  );
  const contents = useMemo(
    () =>
      buildDayContents(
        days,
        shifts,
        notes,
        listSyncs,
        { sortType: sort.type, sortOrder: sort.order, combinedSort },
        () => true
      ),
    [days, shifts, notes, listSyncs, sort.type, sort.order, combinedSort]
  );

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const content of contents.values()) {
      for (const shift of content.layout.visible) {
        const key = chipKeyOf(shift, presetIds);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const result: { key: string; label: string; color?: string; count: number; synced?: boolean }[] = [];
    for (const preset of presets) {
      const count = counts.get(`preset:${preset.id}`);
      if (count) result.push({ key: `preset:${preset.id}`, label: preset.title, color: preset.color, count });
    }
    const none = counts.get(NO_PRESET);
    if (none) result.push({ key: NO_PRESET, label: t("calendarView.listWithoutPreset"), count: none });
    for (const sync of externalSyncs) {
      const count = counts.get(`sync:${sync.id}`);
      if (count) result.push({ key: `sync:${sync.id}`, label: sync.name, color: sync.color, count, synced: true });
    }
    return result;
  }, [contents, presets, presetIds, externalSyncs, t]);

  // A chip can vanish with its last shift or a month change; ignore stale selections
  const chipKeys = new Set(chips.map((c) => c.key));
  const effectiveChips = activeChips.filter((key) => chipKeys.has(key));
  const needle = query.trim().toLocaleLowerCase(locale);
  const filtering = needle.length > 0 || effectiveChips.length > 0;

  const weeks = useMemo(() => {
    const matches = (text: string | null | undefined) =>
      !!text && text.toLocaleLowerCase(locale).includes(needle);
    const groups: {
      key: string;
      start: Date;
      days: { day: Date; key: string; shifts: ShiftWithCalendar[]; events: CalendarNote[]; notes: CalendarNote[] }[];
    }[] = [];

    for (const day of days) {
      const key = formatDateToLocal(day);
      const content = contents.get(key)!;
      const dayShifts = content.layout.visible.filter(
        (shift) =>
          (effectiveChips.length === 0 || effectiveChips.includes(chipKeyOf(shift, presetIds))) &&
          (!needle || matches(shift.title) || matches(shift.notes))
      );
      // Notes never match a preset filter; with a search they must match it
      const showNotes = effectiveChips.length === 0;
      const keepNote = (note: CalendarNote) => showNotes && (!needle || matches(note.note));
      const events = content.events.filter(keepNote);
      const dayNotes = content.notes.filter(keepNote);
      if (filtering && dayShifts.length + events.length + dayNotes.length === 0) continue;

      const start = startOfWeek(day, WEEK);
      const weekKey = formatDateToLocal(start);
      let group = groups[groups.length - 1];
      if (!group || group.key !== weekKey) {
        group = { key: weekKey, start, days: [] };
        groups.push(group);
      }
      group.days.push({ day, key, shifts: dayShifts, events, notes: dayNotes });
    }
    return groups;
    // effectiveChips is rebuilt per render; its joined value is the real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, contents, presetIds, needle, filtering, effectiveChips.join("|"), locale]);

  const scrollToKey = (key: string) => {
    const container = scroller.current;
    const row = rowRefs.current.get(key);
    if (!container) return;
    // 32px keeps the row clear of the sticky week header
    container.scrollTop = row ? Math.max(0, row.offsetTop - 32) : 0;
  };

  const monthKey = days.length > 0 ? formatDateToLocal(days[0]) : "";
  const scrollToFocus = useEffectEvent(() => {
    const todayKey = formatDateToLocal(new Date());
    const selectedKey = formatDateToLocal(selectedDay);
    const inMonth = (key: string) => days.some((d) => formatDateToLocal(d) === key);
    scrollToKey(inMonth(todayKey) ? todayKey : inMonth(selectedKey) ? selectedKey : "");
  });
  useEffect(() => {
    scrollToFocus();
  }, [monthKey]);

  const jumpTo = useEffectEvent((key: string) => scrollToKey(key));
  useEffect(() => {
    if (scrollTarget) jumpTo(scrollTarget.key);
  }, [scrollTarget]);

  const toggleChip = (key: string) =>
    setActiveChips((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const sortLabels: Record<ShiftSortType, string> = {
    startTime: t("view.sortByStartTime"),
    createdAt: t("view.sortByCreatedAt"),
    title: t("view.sortByTitle"),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("flex shrink-0 flex-col gap-2 border-b border-line", desktop ? "px-[18px] pb-2.5 pt-3.5" : "px-3.5 pb-2.5")}>
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("calendarView.listSearchPlaceholder")}
              aria-label={t("calendarView.listSearchPlaceholder")}
              className="h-9 w-full rounded-lg border border-line bg-surface-card pl-8 pr-8 text-[13.5px] text-fg-strong outline-none placeholder:text-fg-faint focus-visible:border-brand-dot [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("common.clear")}
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-fg-tertiary hover:bg-surface-sunken"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={sort.locked}
              title={sort.locked ? t("calendarView.listSortPinnedHint") : t("view.sortOptions")}
              aria-label={t("view.sortOptions")}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-panel disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sort.locked ? <Lock className="size-3.5" /> : <ArrowDownUp className="size-4" />}
              {desktop && sortLabels[sort.type]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("view.sortBy")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort.type}
                onValueChange={(value) => sort.onChange({ sortType: value as ShiftSortType })}
              >
                {(Object.keys(sortLabels) as ShiftSortType[]).map((type) => (
                  <DropdownMenuRadioItem key={type} value={type}>
                    {sortLabels[type]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("view.sortOrder")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort.order}
                onValueChange={(value) => sort.onChange({ sortOrder: value as ShiftSortOrder })}
              >
                <DropdownMenuRadioItem value="asc">{t("view.sortOrderAsc")}</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">{t("view.sortOrderDesc")}</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {desktop && canAddShift && (
            <Button size="sm" onClick={onAddShift} className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-[13px] font-semibold">
              <Plus className="size-[15px]" />
              {t("calendarView.addShiftManually")}
            </Button>
          )}
        </div>
        {chips.length > 0 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
            {chips.map((chip) => {
              const active = effectiveChips.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleChip(chip.key)}
                  className={cn(
                    "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
                    active
                      ? "border-transparent bg-brand-soft text-brand-ink"
                      : "border-line text-fg-secondary hover:bg-surface-panel"
                  )}
                >
                  {chip.synced ? (
                    <RefreshCw className="size-3 shrink-0" />
                  ) : chip.color ? (
                    <span className="shift-rail size-2 shrink-0 rounded-full" style={shiftVars(chip.color)} />
                  ) : null}
                  <span className="max-w-[180px] truncate">{chip.label}</span>
                  <span className="font-mono text-[11px] opacity-70">{chip.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div ref={scroller} className={cn("relative min-h-0 flex-1 overflow-y-auto", desktop ? "px-[18px]" : "px-2")}>
        {weeks.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-fg-tertiary">
            {filtering ? t("calendarView.listNoMatches") : t("shift.noShiftsInMonth")}
          </p>
        ) : (
          weeks.map((week) => (
            <section key={week.key}>
              <h2 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background py-1.5 pl-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">
                {isSameWeek(week.start, new Date(), WEEK) ? (
                  <span className="text-brand-ink">{t("calendarView.thisWeek")}</span>
                ) : (
                  t("calendarView.calendarWeek", { week: getISOWeek(week.start) })
                )}
                <span className="font-mono font-normal normal-case tracking-normal text-fg-faint">
                  {formatWeekRange(week.start, endOfWeek(week.start, WEEK), locale, false)}
                </span>
              </h2>
              {week.days.map(({ day, key, shifts: dayShifts, events, notes: dayNotes }) => {
                const today = isToday(day);
                const selected = isSameDay(day, selectedDay);
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                const highlighted = !!highlightColor && highlightedWeekdays.includes(day.getDay());
                const toggling = togglingDates.has(key);
                const minutes = dayShifts.reduce((sum, s) => sum + getShiftMinutes(s), 0);
                const empty = dayShifts.length + events.length + dayNotes.length === 0;
                const press = dayPress(day);

                return (
                  // Buttons must not nest: the gutter is the real control, the row forwards mouse clicks
                  <div
                    key={key}
                    ref={(el) => {
                      if (el) rowRefs.current.set(key, el);
                      else rowRefs.current.delete(key);
                    }}
                    onClick={toggling ? undefined : press.onClick}
                    onContextMenu={press.onContextMenu}
                    onTouchStart={press.onTouchStart}
                    onTouchEnd={press.onTouchEnd}
                    onTouchMove={press.onTouchMove}
                    style={highlighted ? ({ "--highlight": highlightColor } as React.CSSProperties) : undefined}
                    className={cn(
                      "flex cursor-pointer items-stretch gap-3 rounded-[10px] border-b border-line px-1.5 transition-colors [-webkit-touch-callout:none]",
                      empty ? "py-1.5" : "py-2.5",
                      selected ? "bg-cell-selected" : "hover:bg-surface-panel",
                      highlighted && "day-highlight",
                      toggling && "cursor-wait opacity-60"
                    )}
                  >
                    <button
                      type="button"
                      disabled={toggling}
                      aria-pressed={selected}
                      aria-label={day.toLocaleDateString()}
                      // The row's handler runs through bubbling; this only needs to be focusable
                      className="flex w-11 shrink-0 flex-col items-center gap-0.5 rounded-md pt-0.5 outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
                    >
                      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-cell-muted">
                        {weekdayFormat.format(day)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex size-[26px] items-center justify-center rounded-full font-mono text-[14px] leading-none",
                          today ? TODAY_BADGE : weekend ? "text-cell-weekend-num" : "text-fg-body"
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      {empty ? (
                        <span className="flex h-full items-center text-[12.5px] text-fg-faint">
                          {t("calendarView.dayFree")}
                        </span>
                      ) : (
                        <>
                          {dayShifts.length > 0 && (
                            <span className="font-mono text-[11.5px] text-fg-tertiary">
                              {t("calendarView.shiftCount", { count: dayShifts.length })}
                              {minutes > 0 && ` · ${formatHours(minutes, locale)}`}
                            </span>
                          )}
                          {dayShifts.map((shift) => (
                            <ShiftDetailRow
                              key={shift.id}
                              shift={shift}
                              fullTitle
                              canEdit={canEditShift(shift)}
                              canDelete={canDeleteShift(shift)}
                              actions="menu"
                              // Armed presets win, as in the grids: the click bubbles to the row and stamps
                              onEdit={stampArmed ? () => undefined : onEditShift}
                              onDelete={onDeleteShift}
                            />
                          ))}
                          {events.map((note) => (
                            <EventChip key={note.id} note={note} wrap />
                          ))}
                          {dayNotes.map((note) => (
                            <NoteLine key={note.id} note={note} wrap />
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
```

Notes for the implementer:
- `ShiftDetailRow`'s own `onClick` calls `onEdit` and does **not** stop propagation, so an un-armed click on a shift row both opens the shift sheet and selects the day. That is intended (the inspector follows). When `stampArmed`, `onEdit` is a no-op and the bubbled click stamps.
- The `ShiftDetailRow` dropdown trigger and the quick-signup button already `stopPropagation()`. Radix renders menu items in a portal, but React synthetic events still bubble through the React tree — the existing `e.stopPropagation()` calls on the items cover that.
- `MinimalSyncCounter` is imported for parity but unused because minimal syncs are expanded; remove the import if lint flags it.
- `common.clear` — check `messages/de.json`; if the key does not exist use `common.close`'s sibling that fits, or add `calendarView.listClearSearch` ("Suche leeren") to the key table in Step 6.
- If `DropdownMenuRadioGroup` / `DropdownMenuRadioItem` / `DropdownMenuLabel` are not exported by `components/ui/dropdown-menu.tsx`, use `DropdownMenuItem` with a `Check` icon on the active entry instead; do not edit the primitive.

- [ ] **Step 3: `components/mobile-day-sheet.tsx` — footer list variant**

Add to `MobileDayFooter`'s props: `list?: { nextShift: ShiftWithCalendar | null; onJump: () => void };` (import `ShiftWithCalendar` from `@/lib/types`, `formatTimeRange`, `shiftVars` from `@/lib/shift-display`, `formatLongDate` from `@/lib/date-utils`, `isToday`, `isTomorrow` from `date-fns`, `ChartColumn` from `lucide-react` — skip those already imported).

Inside the component, before `return`:

```tsx
  const next = list?.nextShift ?? null;
  const nextDay = next?.date
    ? isToday(next.date)
      ? t("calendarView.today")
      : isTomorrow(next.date)
        ? t("calendarView.tomorrow")
        : formatLongDate(next.date, locale, { month: "short" })
    : null;
```

Wrap the existing left side: render the block below when `list` is set, the existing `canViewStats ? … : …` otherwise.

```tsx
      {list ? (
        <>
          <button
            type="button"
            onClick={list.onJump}
            disabled={!next}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 text-left"
          >
            {next && (
              <span className="shift-rail h-[30px] w-1 shrink-0 rounded-full" style={shiftVars(next.color)} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] leading-[14px] text-fg-tertiary">
                {t("calendarView.nextShift")}
              </span>
              <span className="block truncate text-[13px] font-semibold leading-5 text-fg-strong">
                {next
                  ? `${next.title} · ${nextDay}${next.isAllDay ? "" : ` · ${formatTimeRange(next)}`}`
                  : t("calendarView.noUpcomingShift")}
              </span>
            </span>
          </button>
          {canViewStats && (
            <button
              type="button"
              onClick={onOpenStats}
              aria-label={t("calendarView.openStats")}
              className="flex size-10 shrink-0 items-center justify-center rounded-[11px] border border-line text-fg-secondary"
            >
              <ChartColumn className="size-[18px]" />
            </button>
          )}
        </>
      ) : canViewStats ? (
        /* existing KPI button, unchanged */
      ) : (
        /* existing "all shifts in month" button, unchanged */
      )}
```

- [ ] **Step 4: `components/calendar-workspace.tsx` — list surface, next shift, jump**

Imports: `ShiftListView, ListSort` from `@/components/shift-list-view`; `formatDateToLocal` from `@/lib/date-utils`.

Props: add `listSort: ListSort;` and `onSelectDay: (day: Date) => void;` (JSDoc: `/** Pure navigation: shows the day's month and selects it, never stamps */`).

State and derived values (next to the other hooks):

```ts
  const [scrollTarget, setScrollTarget] = useState<{ key: string; nonce: number } | null>(null);

  // Own shifts only: imported calendars (holidays, colleagues) are not "my next shift"
  const nextShift = useMemo(() => {
    if (viewMode !== "list") return null;
    const now = new Date();
    const todayKey = formatDateToLocal(now);
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    let best: { shift: ShiftWithCalendar; sortKey: string } | null = null;
    for (const shift of visibleShifts) {
      if (!shift.date || shift.syncedFromExternal) continue;
      const dayKey = formatDateToLocal(shift.date as Date);
      if (dayKey < todayKey) continue;
      // Today's shifts that already ended are over; overnight ones (end < start) still count
      const ended =
        dayKey === todayKey &&
        !shift.isAllDay &&
        shift.endTime > shift.startTime &&
        shift.endTime.slice(0, 5) <= nowTime;
      if (ended) continue;
      const sortKey = `${dayKey} ${shift.isAllDay ? "00:00" : shift.startTime}`;
      if (!best || sortKey < best.sortKey) best = { shift, sortKey };
    }
    return best?.shift ?? null;
  }, [viewMode, visibleShifts]);
```

Extend the `surface` expression with a first branch:

```tsx
    viewMode === "list" ? (
      <ShiftListView
        variant={variant}
        days={calendarDays}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        presets={presets}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        sort={listSort}
        combinedSort={layout.combinedSort ?? false}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        stampArmed={selectedPresetIds.length > 0}
        canAddShift={model.canAddShift}
        onAddShift={actions.onAddShift}
        canEditShift={model.canEditShift}
        canDeleteShift={model.canDeleteShift}
        onEditShift={actions.onEditShift}
        onDeleteShift={actions.onDeleteShift}
        onDayClick={onDayClick}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
        scrollTarget={scrollTarget}
      />
    ) : viewMode === "week" ? (
```

`surface` must now be declared **after** `model` (it reads `model.canAddShift`); move the block below the `model` constant.

Mobile wrapper: change `<div className={`flex flex-1 flex-col pb-1${…}`}>` so it can host an inner scroller:

```tsx
        <div
          className={cn(
            "flex flex-1 flex-col pb-1",
            viewMode === "list" && "min-h-0",
            !isOnline && "opacity-60"
          )}
        >
          {surface}
        </div>
```

(import `cn` from `@/lib/utils`). On phones `<main>` is `overflow-y-auto`; in list mode the list's own scroller must take over, so give `<main>` `overflow-y-auto` only outside list mode: `className={cn("flex min-h-0 flex-1 flex-col", viewMode !== "list" && "overflow-y-auto")}`.

Footer: pass

```tsx
          list={
            viewMode === "list"
              ? {
                  nextShift,
                  onJump: () => {
                    if (!nextShift?.date) return;
                    const day = nextShift.date as Date;
                    onSelectDay(day);
                    setScrollTarget((prev) => ({ key: formatDateToLocal(day), nonce: (prev?.nonce ?? 0) + 1 }));
                  },
                }
              : undefined
          }
```

If the jump crosses into another month the list remounts its rows and its month effect scrolls to today/selection first; the `scrollTarget` effect runs in the same commit afterwards and wins. Verify this in Step 8.

- [ ] **Step 5: `app/page.tsx` — sort binding and pure day selection**

Add to the `<CalendarWorkspace>` props:

```tsx
        listSort={{
          type: calendarView.sortType,
          order: calendarView.sortOrder,
          // A calendar-pinned view replaces the personal one, so the personal sort is moot
          locked: !!calendars.find((c) => c.id === selectedCalendar)?.viewSettings,
          onChange: viewSettings.updatePersonal,
        }}
        onSelectDay={(day) => {
          setCurrentDate(day);
          selectDay(day);
        }}
```

If `CalendarWithCount` has no `viewSettings` field, check how `viewSettings.forCalendar(calendar)` reads it and use the same property.

- [ ] **Step 6: i18n keys**

`messages/de.json` under `calendarView` (after `"viewList"`):

```json
    "thisWeek": "Diese Woche",
    "listSearchPlaceholder": "Schichten und Notizen durchsuchen",
    "listNoMatches": "Keine Treffer für diese Suche oder diesen Filter.",
    "listWithoutPreset": "Ohne Vorlage",
    "listSortPinnedHint": "Dieser Kalender legt die Sortierung fest.",
    "nextShift": "Nächste Schicht",
    "noUpcomingShift": "Keine anstehende Schicht",
```

| key | en | es | fr | it | cs |
|---|---|---|---|---|---|
| thisWeek | This week | Esta semana | Cette semaine | Questa settimana | Tento týden |
| listSearchPlaceholder | Search shifts and notes | Buscar turnos y notas | Rechercher des services et des notes | Cerca turni e note | Hledat směny a poznámky |
| listNoMatches | Nothing matches this search or filter. | Nada coincide con esta búsqueda o filtro. | Aucun résultat pour cette recherche ou ce filtre. | Nessun risultato per questa ricerca o filtro. | Tomuto hledání nebo filtru nic neodpovídá. |
| listWithoutPreset | No preset | Sin plantilla | Sans modèle | Senza modello | Bez šablony |
| listSortPinnedHint | This calendar sets the sort order. | Este calendario define el orden. | Ce calendrier définit le tri. | Questo calendario definisce l'ordinamento. | Řazení určuje tento kalendář. |
| nextShift | Next shift | Próximo turno | Prochain service | Prossimo turno | Další směna |
| noUpcomingShift | No upcoming shift | Ningún turno próximo | Aucun service à venir | Nessun turno in programma | Žádná nadcházející směna |

Before translating "shift"/"preset", grep each locale file for how `calendarView.shift` and `calendarView.stamp` are already translated and use the same word.

- [ ] **Step 7: Enable the mode**

`hooks/useCalendarViewMode.ts`: `AVAILABLE_VIEW_MODES = ["month", "week", "list"]`.

- [ ] **Step 8: Gate + browser check**

Run: `npx tsc --noEmit && npm run lint && npm run i18n` → exit 0.

Browser (1440×900 and 390×844): every day of the month is a row under week headers; "Diese Woche" on the current week; opens scrolled to today. Long titles wrap in full. Search narrows to matching days, chips filter by preset with correct counts, both combine; clearing restores all days. Sort menu changes order within a day and persists; with a calendar-pinned view it is disabled with the hint. Day click selects (inspector/day sheet), armed preset stamps on empty and filled days (also when clicking on a shift row), right-click/long-press opens notes. Shift row click opens the shift sheet, menu edits/deletes; external shifts are read-only. Phone footer shows the next shift, tapping jumps to it (also across months); stats icon opens the stats sheet. `onlyMyShifts` filters the list.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): add list view with search, preset filter and sorting (#185)"
```

---

### Task 5: Retire `MonthShiftsDialog`; its entry points open the list

**Files:**
- Modify: `components/day-inspector.tsx`, `components/mobile-day-sheet.tsx`, `components/calendar-workspace.tsx`, `components/month-dialogs.tsx`, `components/dialog-manager.tsx`, `hooks/useDialogStates.ts`, `app/page.tsx`, `messages/*.json` (only if keys become unused)

**Interfaces:**
- Produces: `DayActions.onShowList?: () => void` (replaces `onOpenMonthShifts`; `undefined` while already in list mode, which hides the entry points). `MobileDayFooter` prop `onShowList?: () => void` (replaces `onOpenMonthShifts`).

- [ ] **Step 1: `components/day-inspector.tsx`**

In `DayActions` replace `onOpenMonthShifts: () => void;` with:

```ts
  /** Switches to the list view; absent while it is already showing */
  onShowList?: () => void;
```

In the bottom section: render the `List` button only when `actions.onShowList` exists (`onClick={actions.onShowList}`), and render the whole `<div className="border-t …">` section only when `canViewStats || actions.onShowList` — otherwise it would be a lone caption.

- [ ] **Step 2: `components/mobile-day-sheet.tsx`**

- `MobileDayFooter`: rename the prop `onOpenMonthShifts` → `onShowList?: () => void`. In the non-stats fallback branch render the "all shifts in month" button only when `onShowList` is set; otherwise render `<span className="flex-1" />` so the "+" stays right-aligned.
- `MobileStatsSheet`: change `{period === "month" && (` to `{period === "month" && actions.onShowList && (` and `onClick={run(actions.onShowList)}`.

- [ ] **Step 3: `components/calendar-workspace.tsx`**

`onOpenMonthShifts={actions.onOpenMonthShifts}` → `onShowList={actions.onShowList}`.

- [ ] **Step 4: `app/page.tsx`**

In the `actions` object replace the `onOpenMonthShifts` line with:

```ts
          onShowList:
            viewMode === "list"
              ? undefined
              : () => {
                  setDaySheetOpen(false);
                  handleViewModeChange("list");
                },
```

Remove the `showMonthShiftsDialog` / `onMonthShiftsDialogChange` props from `<DialogManager>`.

- [ ] **Step 5: Remove the dialog**

- `components/month-dialogs.tsx`: delete `MonthShiftsDialog` and the imports only it used (`useMemo`, `useLocale`, `format`, `ShiftDetailRow`, `ShiftWithCalendar`, `getDateLocale`, `formatDateToLocal`, `formatLongDate`, `formatHours`, `getShiftMinutes`, `sortShifts` — keep what `MonthStatsDialog` needs).
- `components/dialog-manager.tsx`: remove the `MonthShiftsDialog` import, its JSX block, and the `showMonthShiftsDialog` / `onMonthShiftsDialogChange` props. Then check each of `shifts`, `canEditShift`, `canDeleteShift`, `onDeleteShift`, `currentDate` in `DialogManagerProps`: if nothing else in the file reads a prop, remove it from the interface and from `app/page.tsx`'s `<DialogManager>` call.
- `hooks/useDialogStates.ts`: remove `showMonthShiftsDialog` / `setShowMonthShiftsDialog`.

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit && npm run lint && npm run i18n`
Expected: exit 0. If `npm run i18n` reports unused keys, delete them from all six locale files (`calendarView.allShiftsIn` and `shift.noShiftsInMonth` are still used and must stay).

- [ ] **Step 7: Browser check**

Desktop inspector list icon, phone footer fallback button (calendar without `viewStats`), and the button inside the stats sheet each switch to the list view and close any open sheet; in list mode none of the three is shown.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(ui): open the list view instead of the month shifts dialog"
```

---

### Task 6: Final verification

- [ ] **Step 1:** `npm run build` → succeeds (this is CI's type check).
- [ ] **Step 2:** Run the spec's full verification list (`Verification` section) with Playwright at 1440×900 and 390×844, including: read-only / guest calendar in all three modes, offline dimming, `AUTH_ENABLED=false` if the dev environment uses it, dark mode spot check of week and list.
- [ ] **Step 3:** `git status` clean except intended files; `git log --oneline origin/main..` shows the spec, the plan and the five commits above.
