# Calendar View Modes (Month / Week / List) — Design

Source: GitHub issues [#184](https://github.com/panteLx/BetterShift/issues/184) (week view), [#185](https://github.com/panteLx/BetterShift/issues/185) (list view) and [#186](https://github.com/panteLx/BetterShift/issues/186) (switcher). The month grid is the only calendar surface today; week-by-week planners have to read a whole month, and shift titles truncate in the narrow month cells with no surface that shows them in full.

## Goals

- Three renderings of the same calendar data — month (today's grid), week, list — selectable through one control in the header.
- Switching the mode never changes the period being looked at, only how it is rendered.
- Every existing day interaction (select, stamp/toggle a preset, note context menu / long press, day inspector, mobile day sheet, read-only and guest states, `onlyMyShifts`) behaves identically in all three modes.
- The list view shows full, un-truncated shift titles and replaces the read-only "all shifts in <month>" dialog.

## Non-goals

- No schema, API or fetching change. Shifts, notes, presets and external syncs are already loaded per calendar without a date scope; week and list filter the arrays that are in memory.
- The mode is not an account-synced preference and cannot be pinned by a calendar (`calendars.viewSettings`). `lib/view-settings.ts` is untouched.
- Compare mode stays a month view; the switcher is not shown there.
- Week start stays hardcoded to Monday, as everywhere else in the app.
- No time-axis ("agenda with hours") week layout; the week view is day columns with stacked entries.
- No swipe gesture for paging.

## Decisions taken with the maintainer

| Question | Decision |
|---|---|
| Persisting the mode (open in #184/#186) | `localStorage`, per device. Survives reloads, not synced to the account. |
| Week view architecture | New `WeekGrid` component; the cell entry renderers are extracted from `MonthGrid` and shared. |
| Week view on phones | Seven full-width day rows stacked vertically, not seven ~54px columns. |
| Old `MonthShiftsDialog` | Removed. Its three entry points switch to list mode instead. |
| Delivery | One branch `feat/calendar-view-modes`, one `feat` commit per issue (#186 → #184 → #185). |

## Mode state and navigation (#186)

### `hooks/useCalendarViewMode.ts`

```ts
export type CalendarViewMode = "month" | "week" | "list";
export function useCalendarViewMode(): [CalendarViewMode, (mode: CalendarViewMode) => void];
```

- Backed by `localStorage` key `calendar-view-mode` (kebab-case, matching the per-device keys in `hooks/useViewSettings.ts`). Unknown or missing values resolve to `"month"`.
- Read through `useSyncExternalStore` with a server snapshot of `"month"`, so SSR and first client render agree and there is no hydration mismatch. Storage access is wrapped in try/catch like `readStorage` in `useViewSettings.ts`.
- Owned by `app/page.tsx`. While compare mode is active the page ignores the stored mode and nothing of this feature renders.

### Date anchor

`currentDate` in `app/page.tsx` stays the single anchor:

| Mode | Visible period | Days passed down | Step |
|---|---|---|---|
| month | month of `currentDate` | `getCalendarDays(currentDate)` | ±1 month |
| week | Monday–Sunday week containing `currentDate` | `getWeekDays(currentDate)` | ±1 week |
| list | month of `currentDate` | every day of that month (`getMonthDays(currentDate)`) | ±1 month |

`getWeekDays` and `getMonthDays` are added to `lib/calendar-utils.ts` next to `getCalendarDays`.

Mode changes go through one page handler:

- → `week`: if `selectedDay` lies in the visible month, `currentDate` is set to `selectedDay`, so the week shown is the one the user was focused on. The visible month does not change by this. Otherwise `currentDate` is kept.
- → `month` / `list`: `currentDate` is kept; the month of the week's anchor is shown. Going back to `week` lands on the same week because the anchor never moved.

`handleDateChange` becomes mode-aware: in week mode, when `selectedDay` falls outside the new week it moves to today if today is in that week, else to the same weekday of the new week. Month and list keep today's behaviour (today or the 1st).

`handleDayClick` is unchanged. Its `!isSameMonth(day, currentDate) → setCurrentDate(day)` branch is harmless in week mode: a day of a month-straddling week is still in the same week.

### Stepper and caption

`MonthStepper` and `MonthArrows` in `components/app-header.tsx` gain `step?: "month" | "week"` (default `"month"`, so `compare-workspace.tsx` needs no change):

- `step="week"` uses `addWeeks`/`subWeeks`, aria labels `calendarView.previousWeek` / `calendarView.nextWeek`.
- The caption comes from a new `formatPeriodCaption(date, step, locale)` helper in `lib/date-utils.ts`: month → `LLLL yyyy` as today; week → a locale-formatted range that collapses shared parts ("8.–14. Sep. 2026", "29. Sep. – 5. Okt. 2026", "29. Dez. 2025 – 4. Jan. 2026"), built with `Intl.DateTimeFormat(locale).formatRange`. The desktop stepper appends the ISO week as muted text using the existing `calendarView.calendarWeek` key. The stepper's label min-width grows in week mode so the arrows don't jump.
- The mobile title in `calendar-workspace.tsx` uses the same helper.

### Switcher

`components/view-mode-switcher.tsx` wraps `components/segmented-control.tsx`:

- **Desktop**: in `AppHeader`'s desktop row directly right of `MonthStepper` (before the flex spacer), text labels `calendarView.viewMonth|viewWeek|viewList`.
- **Mobile**: in the title row of `CalendarWorkspace`, between the title and `MonthArrows`. Three text segments do not fit next to a week-range title at 360px, so the phone variant renders icons (`CalendarDays`, `CalendarRange`, `List`) with the labels as `aria-label`/`title`. `SegmentedControl`'s `label` is typed `string` and rendered as the button content; it is widened to `React.ReactNode` plus an optional per-option `ariaLabel`. This is a project component, not a generated shadcn primitive.
- `AppHeader` gets `viewMode` / `onViewModeChange` props; when `onViewModeChange` is absent the switcher is not rendered.

## Week view (#184)

### Shared cell renderers — `components/day-cell-entries.tsx`

Extracted from `MonthGrid` without behaviour change:

- `ShiftChip`, `ExternalShiftChip`, `EventChip`, `NoteLine` — the four desktop entry renderers (today inline in `renderDesktop`), with a `truncate` flag so the week/list surfaces can let titles wrap.
- `SignupBadge` and the `signupsEnabledById` lookup as a `useSignupsEnabled()` hook.
- `MinimalSyncCounter` — the count-only external sync pill from `renderDesktopHead`.
- `useDayPress(onClick, onContextMenu)` — the click / context-menu / 500 ms long-press handler bundle, returning the props to spread on a day button.
- `buildDayContents(days, shifts, notes, externalSyncs, layout, includeDay)` — the one-pass bucketing from the `dayContents` memo. `MonthGrid` passes `includeDay = day is in the current month` (today's behaviour); week and list pass `() => true`.
- `TODAY_BADGE` moves here.

`MonthGrid` keeps its px fitting, its three variants and its markup; it only imports these pieces.

### `components/week-grid.tsx`

Props mirror `MonthGrid` minus `variant`/`currentDate`, plus `variant: "desktop" | "phone"`. Content is built without `maxShifts` / `maxExternalShifts` (`undefined` = uncapped in `buildDayShiftLayout`) — the per-day cap exists to fit month cells and does not apply here — while `sortType` / `sortOrder` / `combinedSort` are honoured.

- **Desktop**: one row of seven columns filling the main area. Column header: long weekday name plus day number (today badge, muted month abbreviation when the week straddles two months). The column itself is the day button (`useDayPress`), scrolls vertically on overflow, and stacks all entries with wrapping titles, full time range (`formatTimeRange`), signup badge and — when `showShiftNotes` is on — the shift note in full. Weekend tint, weekday highlight, selection ring, `togglingDates` disabled state and focus ring match the month cell.
- **Phone**: seven full-width rows. Left: short weekday + day number (today/selected styling as in the phone month cell). Right: entries as full-width fields with title and time, events and notes below. Rows grow with their content; the page scrolls. A highlighted weekday tints the row.
- Days outside `currentDate`'s month are not dimmed and show full content.

`CalendarWorkspace` picks `MonthGrid`, `WeekGrid` or the list by a new `viewMode` prop. `DayInspector`, `StampDock`, `MobilePresetBar`, `MobileDayFooter`, the sheets, banners and the offline dimming are shared by all modes. The month summary (inspector KPIs, mobile footer) stays anchored on `currentDate`'s month in every mode.

## List view (#185)

### `components/shift-list-view.tsx`

Replaces the grid in list mode; the stamp bar and inspector stay where they are.

**Rows.** One row per calendar day of the month — every day must be present so stamping by day click keeps working. The row is the day button (`useDayPress`: select, stamp, note context menu). Left: weekday + day number. Right: that day's shifts as `ShiftDetailRow` (`components/day-detail.tsx`, `actions="menu"`, per-shift `canEditShift`/`canDeleteShift`, read-only for `syncedFromExternal`), which already shows color rail, full title, time range and duration; then events and notes as compact one-line entries. Empty days render a slim row with the existing `calendarView.dayEmpty` text. Buttons must not nest, so the row is a `div`: the left date gutter is the actual `<button>` (`useDayPress`, `aria-pressed`, disabled while toggling) and stretches over the row's height; the row container additionally forwards plain mouse clicks and the context menu on its free area to the same handlers, while `ShiftDetailRow`'s menu stops propagation.

**Grouping.** Rows sit under sticky week headers: "Diese Woche" (`calendarView.thisWeek`) for the current week, otherwise `KW n · <range>` via `formatPeriodCaption`. Day header meta shows shift count and hours like the old dialog (`calendarView.shiftCount`, `formatHours`).

**Toolbar** (sticky above the rows):

- Search input — matches shift title and shift notes, event/note text; case-insensitive.
- Preset filter chips with counts for the visible month, built from `shift.presetId` joined with `presets` (color + title); shifts without a preset fall under one "Ohne Vorlage" chip, externally synced shifts under one chip per sync. Multi-select; no chip active = all.
- Sort control bound to the personal `sortType` / `sortOrder` through `updatePersonal` from `useViewSettings` — no new sort state. When the calendar pins its own view the control is disabled with a hint (`calendarView.listSortPinnedHint`), since the personal value would not apply. Days are always chronological; sorting applies within a day.
- "Schicht manuell" button → `actions.onAddShift` for the selected day; hidden without `canAddShift`.

While a search or filter is active, days without a match are hidden, and events/notes only show when they match the search (they never match a preset filter). An empty result shows `shift.noShiftsInMonth` or a "no matches" text.

Search and filter are component state and reset on calendar switch.

**Scroll position.** On mount and when the month changes, the list scrolls to today's row if it is in the month, else to `selectedDay`, else the top.

**Mobile footer.** In list mode `MobileDayFooter`'s left side shows the next upcoming shift of the calendar (first shift today-or-later by date and start time, from `visibleShifts`): title, relative day (`today`/`tomorrow`/date) and time. Tapping it navigates to that shift's month, selects the day and scrolls to it. Without an upcoming shift it shows `calendarView.noUpcomingShift`. The "+" button stays; a compact stats icon button is added next to it when `canViewStats`, so list mode does not lose the stats entry the KPI strip provides in the other modes.

### Removing `MonthShiftsDialog`

- Delete `MonthShiftsDialog` from `components/month-dialogs.tsx` (`MonthStatsDialog` stays), its wiring in `components/dialog-manager.tsx`, `showMonthShiftsDialog` in `hooks/useDialogStates.ts` and the props in `app/page.tsx`.
- `DayActions.onOpenMonthShifts` is renamed `onShowList` and sets the mode to `"list"` (closing the mobile day/stats sheet first). Its three entry points — `DayInspector`, `MobileDayFooter` fallback button, `MobileStatsSheet` — are hidden while already in list mode.
- `ShiftsOverviewDialog` (single day) is untouched.

## i18n

New keys under `calendarView` in `messages/de.json` first, then mirrored to `en`, `es`, `fr`, `it`, `cs`: `viewMode`, `viewMonth`, `viewWeek`, `viewList`, `previousWeek`, `nextWeek`, `thisWeek`, `listSearchPlaceholder`, `listNoMatches`, `listWithoutPreset`, `listSort`, `listSortPinnedHint`, `nextShift`, `noUpcomingShift`, `addShiftManually` (final names settle during implementation; reuse existing keys where one fits). Keys left unused by the dialog removal are deleted so `npm run i18n` stays green.

## Files

| New | Purpose |
|---|---|
| `hooks/useCalendarViewMode.ts` | persisted mode |
| `components/view-mode-switcher.tsx` | segmented control, desktop + phone variant |
| `components/day-cell-entries.tsx` | shared renderers, `useDayPress`, `buildDayContents` |
| `components/week-grid.tsx` | week view |
| `components/shift-list-view.tsx` | list view |

Changed: `app/page.tsx`, `components/app-header.tsx`, `components/calendar-workspace.tsx`, `components/month-grid.tsx`, `components/segmented-control.tsx`, `components/day-inspector.tsx`, `components/mobile-day-sheet.tsx`, `components/month-dialogs.tsx`, `components/dialog-manager.tsx`, `hooks/useDialogStates.ts`, `lib/calendar-utils.ts`, `lib/date-utils.ts`, `messages/*.json`.

## Commits

1. `feat(ui): add month/week/list switcher to the header (#186)` — mode hook, switcher, week-aware stepper/caption, mode-aware date handlers. The switcher lists only modes that exist, so it appears with commit 2.
2. `feat(ui): add week view (#184)` — shared renderers extraction, `WeekGrid`, `"week"` enabled.
3. `feat(ui): add list view and retire the month shifts dialog (#185)` — `ShiftListView`, footer change, dialog removal, `"list"` enabled.

## Verification

No unit-test framework exists in this repo. Per commit: `npx tsc --noEmit`, `npm run lint`, `npm run i18n`; at the end `npm run build`. Manual/Playwright pass at 1440×900 and 390×844 covering: mode switching keeps the period; week stepping across a month and a year boundary; stamping and un-stamping in all three modes; note long-press / context menu; list search, preset filter, sort control (enabled, and disabled under a calendar-pinned view); removed-dialog entry points switch to list; read-only/guest calendar; reload restores the mode; compare mode unaffected; month view pixel-identical to before the extraction.
