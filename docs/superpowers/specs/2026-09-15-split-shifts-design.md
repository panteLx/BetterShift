# Split Shifts — Design

Source: [GitHub issue #191](https://github.com/panteLx/BetterShift/issues/191). Common in German elder care ("Altenpflege"): a single duty made of two or more non-contiguous time ranges on the same day, e.g. `06:00–10:00` and `15:00–21:00`.

## Goals

- A shift (and a preset) can have one or more time ranges on the same calendar day, not just one.
- Backward compatible: the vast majority of shifts stay single-range and every existing code path that reads `shift.startTime`/`shift.endTime` keeps working unmodified.
- Opt-in per calendar, owner/admin controlled, off by default.

## Non-goals

- A time range spanning midnight *within* a split shift (multi-range wraparound). A single-range shift crossing midnight is already supported today and is untouched.
- Per-range signups. A signup still applies to the whole shift.
- A generic multi-range concept for anything other than shifts/presets (e.g. notes, external events).

## Data model

Two new child tables, following the existing `shiftSignups` one-to-many-on-parent-id pattern rather than a JSON column (no JSON-blob precedent exists for arbitrary per-row data in this schema; the closest JSON columns, `calendars.viewSettings` and `calendarPermissionBundles.capabilities`, are fixed-shape and code-typed, not applicable here):

```ts
export const shiftTimeSegments = sqliteTable(
  "shift_time_segments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    shiftId: text("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("shift_time_segments_shiftId_idx").on(table.shiftId)]
);

export const presetTimeSegments = sqliteTable(
  "preset_time_segments",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    presetId: text("preset_id").notNull().references(() => shiftPresets.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("preset_time_segments_presetId_idx").on(table.presetId)]
);
```

- These tables hold **only the additional ranges** (segment 2, 3, …). The first/primary range stays on `shifts.startTime`/`endTime` and `shiftPresets.startTime`/`endTime` exactly as today.
- No `order` column: write-time validation enforces chronological order, read-time code sorts by `startTime` if it ever needs to (in practice segments are already stored in order).
- Relations added to `shiftsRelations`/`shiftPresetsRelations` (`many(shiftTimeSegments)` / `many(presetTimeSegments)`).

New column:

```ts
// calendars table
splitShiftsEnabled: integer("split_shifts_enabled", { mode: "boolean" }).notNull().default(false),
```

Modeled exactly after `signupsEnabled` ("master switch... Owner/admin only"): a calendar-wide feature flag, not a permission-bundle capability. Off hides the extra segments everywhere (same behavior contract as `signupsEnabled`), not just in the create form — if a calendar's owner turns it off after split shifts already exist, those shifts fall back to showing/using only their primary range until the owner turns it back on. Data in `shiftTimeSegments` is not deleted when the flag is turned off.

No data migration needed beyond the schema migration itself — existing shifts/presets are untouched (no rows in the new tables, flag defaults `false`).

## Validation

Applied both client-side (immediate form feedback) and server-side (routes have no centralized Zod layer today; validation stays inline like the rest of `app/api/shifts/**` and `app/api/presets/**`):

- All ranges (primary + segments) must be non-overlapping and in chronological order, compared as same-day minute-of-day values (no midnight wraparound across ranges — see Non-goals).
- The server additionally rejects a write with more than one range when `calendars.splitShiftsEnabled` is `false` for the target calendar — the flag is enforced, not just hidden in the UI.

## API contract

Request bodies for `POST`/`PATCH` on `/api/shifts`, `/api/shifts/[id]`, `/api/presets`, `/api/presets/[id]` gain a `timeRanges: { startTime: string; endTime: string }[]` field (`length >= 1`, replaces sending `startTime`/`endTime` directly). Server maps `timeRanges[0]` to the parent row's `startTime`/`endTime` and persists `timeRanges.slice(1)` as segment rows, in one transaction alongside the rest of the existing create/update logic.

Response shape stays backward compatible: `startTime`/`endTime` remain top-level fields on the returned shift/preset (the primary range), plus a new optional `segments: { startTime: string; endTime: string }[]` array (only the additional ranges, empty for normal shifts). Any existing reader of `shift.startTime` needs no change; segment-aware code reads `[{ startTime: shift.startTime, endTime: shift.endTime }, ...(shift.segments ?? [])]`.

## Frontend

- `hooks/useShiftForm.ts` / the preset equivalent hold a `timeRanges` array in form state instead of two scalar fields. Preset→shift copy logic copies `preset.segments` into the new shift's `timeRanges`.
- `components/shift-form-fields.tsx` / `components/preset-form.tsx`: render one row of start/end pickers per range; an "add range" action appears only when `calendar.splitShiftsEnabled`; a remove ("×") action appears once there is more than one row.
- `hooks/useDirtyState` comparison changes from two scalar fields to an array diff.
- `lib/shift-display.ts`:
  - `formatTimeRange()` extended to join multiple ranges (`"06:00–10:00, 15:00–21:00"`). Consumed as-is by `day-detail.tsx` and `shift-sheet.tsx` — both already funnel through this one shared, responsive component for desktop and phone, so no separate mobile treatment is needed (confirmed by inspection: the phone month-grid chips display no time at all today, only the shift title, so they are unaffected either way).
  - New `calculateSegmentsDuration(ranges)` sums `calculateShiftDuration()` per range; replaces the single-pair call in `app/api/shifts/stats/route.ts` and wherever `shift-display.ts` computes a shift's duration.
- `components/month-grid.tsx` desktop chip: shows the combined `formatTimeRange()` label instead of just `startTime`. Phone chip: unchanged (no time shown there today).
- `sortShifts` (`lib/shift-display.ts`) keeps sorting by `startTime` — validation guarantees that's the earliest range, so no change in meaning.

## Exports & sync

- **PDF** (`app/api/export/pdf/route.ts`): use the same joined range string instead of the current single `startTime`–`endTime` interpolation.
- **ICS** (`app/api/export/ics/route.ts`): a split shift becomes multiple VEVENTs — one per range, same `SUMMARY`/`DESCRIPTION`, `UID` of `"<shiftId>"` for the primary range and `"<shiftId>-seg-<n>"` for each additional one, each with its own `DTSTART`/`DTEND`.
- **External sync** (`lib/external-calendar-utils.ts`, the sync route): unaffected. Incoming events always produce single-range shifts; `shiftTimeSegments` is never populated by sync, so the fingerprint/`needsUpdate` diff logic needs no changes.

## Calendar settings UI

- New toggle in `components/calendar-permissions-panel.tsx`, next to the existing `signupsEnabled` toggle, backed by `splitShiftsEnabled` on the same `PATCH /api/calendars/[id]` route, gated by the same `manageCalendarSettings` capability check already used for that route.

## i18n

New keys (added to `messages/de.json` first, then mirrored to `en`/`es`/`fr`/`it`/`cs` per the project's i18n workflow): add/remove time range labels, the calendar-settings toggle label + description, and the two validation error messages (overlap, chronological order).

## Testing

No unit-test framework in this repo — verification is the standard `npm test` pipeline (lint + build + i18n) plus manual exercising of the feature in the running app (create/edit a split shift and a split preset, toggle the calendar setting off and confirm segments disappear, check PDF and ICS export output, confirm a non-split calendar and non-split shifts are pixel-for-pixel unaffected).
