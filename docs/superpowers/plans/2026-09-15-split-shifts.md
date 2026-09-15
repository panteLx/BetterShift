# Split Shifts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a shift (and a preset) have more than one time range on the same day — e.g. `06:00–10:00` and `15:00–21:00` in one duty — gated per calendar behind an owner/admin-controlled toggle, without changing behavior for the (majority) single-range case.

**Architecture:** The primary time range stays on `shifts.startTime`/`endTime` and `shiftPresets.startTime`/`endTime` exactly as today. Two new child tables (`shiftTimeSegments`, `presetTimeSegments`) hold only the *additional* ranges, following the existing `shiftSignups` one-to-many-on-parent-id pattern. A new `calendars.splitShiftsEnabled` boolean (default `false`) gates the feature per calendar, modeled byte-for-byte on the existing `calendars.signupsEnabled` master switch.

**Tech Stack:** Next.js 16 (App Router) API routes, Drizzle ORM / SQLite (better-sqlite3), React 19 client components, TanStack Query, next-intl.

**Spec:** `docs/superpowers/specs/2026-09-15-split-shifts-design.md`

## Global Constraints

- No unit-test framework in this repo. Verification is `npx tsc --noEmit` (fast, run after almost every step) and the full `npm test` (lint + build + i18n) at task boundaries — see `CLAUDE.md`.
- Never write raw `ALTER TABLE` SQL by hand — always edit `lib/db/schema.ts` then run `npm run db:generate` (creates the `.sql`, snapshot, and `_journal.json` entry together) followed by `npm run db:migrate`.
- `messages/de.json` is the source of truth for i18n; add a key there first, then mirror the same key into `en.json`, `es.json`, `fr.json`, `it.json`, `cs.json` before running `npm run i18n`.
- `startTime`/`endTime` on `shifts`/`shiftPresets` must keep meaning exactly what they mean today (the primary/first range) — every task must stay backward compatible for code that only reads those two fields.
- Segments are validated (chronological, non-overlapping, same-day, no midnight wraparound) only when there is more than one range; a single range keeps 100% of its current behavior, including overnight shifts.
- Follow existing code style: no comments unless they explain a non-obvious constraint; German UI strings mirror the tone of neighboring keys (see `sharingSheet.signupsEnabledLabel`/`Desc` for the reference tone).

---

### Task 1: Schema, migration, and shared types

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/types.ts`
- Modify: `hooks/useCalendars.ts`
- Create (generated): `drizzle/00XX_*.sql`, `drizzle/meta/00XX_snapshot.json`, updated `drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `shiftTimeSegments` table (`id`, `shiftId`, `startTime`, `endTime`, `createdAt`), `presetTimeSegments` table (`id`, `presetId`, `startTime`, `endTime`, `createdAt`), `calendars.splitShiftsEnabled: boolean`, `shiftsRelations.segments` / `shiftPresetsRelations.segments` (Drizzle relations), `ShiftWithCalendar.segments?: { startTime: string; endTime: string }[]`, `CalendarWithCount.splitShiftsEnabled?: boolean`, `CalendarUpdateInput.splitShiftsEnabled?: boolean`.

- [ ] **Step 1: Add the two child tables to the schema**

In `lib/db/schema.ts`, add right after the `shiftPresets` table definition (before `calendarNotes`):

```ts
export const shiftTimeSegments = sqliteTable(
  "shift_time_segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("shift_time_segments_shiftId_idx").on(table.shiftId)]
);

export const presetTimeSegments = sqliteTable(
  "preset_time_segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    presetId: text("preset_id")
      .notNull()
      .references(() => shiftPresets.id, { onDelete: "cascade" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("preset_time_segments_presetId_idx").on(table.presetId)]
);
```

- [ ] **Step 2: Add `splitShiftsEnabled` to `calendars`**

In the `calendars` table definition, right after the existing `signupsEnabled` field:

```ts
    // Master switch for split shifts (multiple time ranges per shift/preset)
    // on this calendar. Owner/admin only; off hides extra ranges everywhere,
    // same contract as signupsEnabled above.
    splitShiftsEnabled: integer("split_shifts_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
```

- [ ] **Step 3: Wire up relations**

In `shiftsRelations`, add a `segments` relation next to `signups`:

```ts
export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  calendar: one(calendars, {
    fields: [shifts.calendarId],
    references: [calendars.id],
  }),
  preset: one(shiftPresets, {
    fields: [shifts.presetId],
    references: [shiftPresets.id],
  }),
  signups: many(shiftSignups),
  segments: many(shiftTimeSegments),
  creator: one(user, {
    fields: [shifts.createdBy],
    references: [user.id],
  }),
}));
```

In `shiftPresetsRelations`, add the equivalent (it currently only has `one`, so switch its factory to also destructure `many`):

```ts
export const shiftPresetsRelations = relations(shiftPresets, ({ one, many }) => ({
  calendar: one(calendars, {
    fields: [shiftPresets.calendarId],
    references: [calendars.id],
  }),
  segments: many(presetTimeSegments),
  creator: one(user, {
    fields: [shiftPresets.createdBy],
    references: [user.id],
  }),
}));
```

Add the two matching one-side relations, anywhere near the other `*Relations` exports:

```ts
export const shiftTimeSegmentsRelations = relations(shiftTimeSegments, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftTimeSegments.shiftId],
    references: [shifts.id],
  }),
}));

export const presetTimeSegmentsRelations = relations(presetTimeSegments, ({ one }) => ({
  preset: one(shiftPresets, {
    fields: [presetTimeSegments.presetId],
    references: [shiftPresets.id],
  }),
}));
```

- [ ] **Step 4: Generate and apply the migration**

Run:
```bash
npm run db:generate
npm run db:migrate
```
Expected: a new `drizzle/00XX_<name>.sql` containing two `CREATE TABLE` statements and one `ALTER TABLE calendars ADD split_shifts_enabled ...` statement, plus an updated `drizzle/meta/_journal.json` with one new entry. `db:migrate` exits 0.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (the new tables/relations are additive).

- [ ] **Step 6: Update `lib/types.ts`**

Add a `TimeRange` re-export-friendly field to `ShiftWithCalendar` and `splitShiftsEnabled` to `CalendarWithCount`:

```ts
export interface CalendarWithCount {
  id: string;
  name: string;
  color: string;
  ownerId?: string | null;
  guestBundleId?: string | null;
  signupsEnabled?: boolean;
  splitShiftsEnabled?: boolean;
  /** The calendar's own view; null means everyone sees their personal view */
  viewSettings?: CalendarViewSettings | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  _count?: number;
  capabilities?: Capability[];
  bundle?: CalendarBundleRef | null;
  isSubscribed?: boolean;
  subscriptionSource?: "guest" | "shared" | "token";
  canSignUpSelf?: boolean;
  canSignUpOthers?: boolean;
}

export interface ShiftWithCalendar {
  id: string;
  calendarId: string;
  presetId?: string | null;
  calendar?: {
    id: string;
    name: string;
    color: string;
  };
  date: Date | null;
  startTime: string;
  endTime: string;
  title: string;
  color: string;
  notes?: string | null;
  isAllDay?: boolean;
  syncedFromExternal?: boolean;
  externalSyncId?: string | null;
  signupCapacity?: number | null;
  signups?: ShiftSignupUser[];
  /** Additional time ranges beyond startTime/endTime (split shifts). Empty/undefined for a normal shift. */
  segments?: { startTime: string; endTime: string }[];
  createdBy?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
```

- [ ] **Step 7: Update `hooks/useCalendars.ts`**

Add the field to `CalendarUpdateInput`:

```ts
export interface CalendarUpdateInput {
  name?: string;
  color?: string;
  guestBundleId?: string | null;
  viewSettings?: CalendarViewSettings | null;
  signupsEnabled?: boolean;
  splitShiftsEnabled?: boolean;
}
```

- [ ] **Step 8: Type-check again**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add lib/db/schema.ts lib/types.ts hooks/useCalendars.ts drizzle
git commit -m "feat(db): add split-shift time segments and calendar toggle"
```

---

### Task 2: Client-safe time-range logic

**Files:**
- Create: `lib/time-ranges.ts`

**Interfaces:**
- Consumes: nothing project-specific (pure functions).
- Produces: `TimeRange` type, `toTimeRanges(entity: { startTime: string; endTime: string; segments?: TimeRange[] }): TimeRange[]`, `validateTimeRanges(ranges: TimeRange[]): TimeRangeError | null`, `TimeRangeError` union, `sumRangeDurations(ranges: TimeRange[]): number`.

- [ ] **Step 1: Write the module**

```ts
import { calculateShiftDuration } from "@/lib/date-utils";

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export type TimeRangeError = "invalid_format" | "overnight_segment" | "overlap";

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Reassembles the primary range plus any extra segments into one ordered-by-input list. */
export function toTimeRanges(entity: {
  startTime: string;
  endTime: string;
  segments?: TimeRange[];
}): TimeRange[] {
  return [
    { startTime: entity.startTime, endTime: entity.endTime },
    ...(entity.segments ?? []),
  ];
}

/**
 * Validates a full list of ranges for a shift/preset. A single range is
 * always valid here (including one that crosses midnight — unchanged
 * existing behavior); chronological order, non-overlap and same-day-only
 * are enforced only once there is more than one range.
 */
export function validateTimeRanges(ranges: TimeRange[]): TimeRangeError | null {
  for (const range of ranges) {
    if (!TIME_PATTERN.test(range.startTime) || !TIME_PATTERN.test(range.endTime)) {
      return "invalid_format";
    }
  }

  if (ranges.length <= 1) return null;

  for (const range of ranges) {
    if (toMinutes(range.endTime) <= toMinutes(range.startTime)) {
      return "overnight_segment";
    }
  }

  const sorted = [...ranges].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
      return "overlap";
    }
  }

  return null;
}

/** Total duration across all ranges, in minutes. */
export function sumRangeDurations(ranges: TimeRange[]): number {
  return ranges.reduce(
    (total, range) => total + calculateShiftDuration(range.startTime, range.endTime),
    0
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (this file has no callers yet, so it must compile standalone).

- [ ] **Step 3: Sanity-check the validation logic with a throwaway script**

Run:
```bash
npx tsx -e "
import { validateTimeRanges } from './lib/time-ranges';
console.log(validateTimeRanges([{ startTime: '06:00', endTime: '10:00' }])); // null
console.log(validateTimeRanges([{ startTime: '22:00', endTime: '06:00' }])); // null (single range, overnight ok)
console.log(validateTimeRanges([{ startTime: '06:00', endTime: '10:00' }, { startTime: '15:00', endTime: '21:00' }])); // null
console.log(validateTimeRanges([{ startTime: '15:00', endTime: '21:00' }, { startTime: '06:00', endTime: '10:00' }])); // null (order-independent input)
console.log(validateTimeRanges([{ startTime: '06:00', endTime: '10:00' }, { startTime: '09:00', endTime: '12:00' }])); // 'overlap'
console.log(validateTimeRanges([{ startTime: '22:00', endTime: '06:00' }, { startTime: '08:00', endTime: '12:00' }])); // 'overnight_segment'
"
```
Expected output, one value per line: `null`, `null`, `null`, `null`, `overlap`, `overnight_segment`. If any line differs, fix `validateTimeRanges` before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/time-ranges.ts
git commit -m "feat: add client-safe time-range validation and duration helpers"
```

---

### Task 3: Server-side segment persistence helpers

**Files:**
- Create: `lib/shift-time-ranges.ts`

**Interfaces:**
- Consumes: `TimeRange` from `lib/time-ranges.ts`; `db`, `shiftTimeSegments`, `presetTimeSegments` from `lib/db`/`lib/db/schema`.
- Produces: `replaceShiftSegments(tx, shiftId, ranges)`, `replacePresetSegments(tx, presetId, ranges)`, `withShiftSegments<T extends {id: string}>(rows: T[])`, `withPresetSegments<T extends {id: string}>(rows: T[])`.

- [ ] **Step 1: Write the module**

```ts
import { db } from "@/lib/db";
import { shiftTimeSegments, presetTimeSegments } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { TimeRange } from "@/lib/time-ranges";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replaces every extra segment for one shift (delete-then-insert), inside an existing transaction. */
export function replaceShiftSegments(tx: Tx, shiftId: string, ranges: TimeRange[]): void {
  tx.delete(shiftTimeSegments).where(eq(shiftTimeSegments.shiftId, shiftId)).run();
  if (ranges.length > 0) {
    tx.insert(shiftTimeSegments)
      .values(ranges.map((r) => ({ shiftId, startTime: r.startTime, endTime: r.endTime })))
      .run();
  }
}

/** Replaces every extra segment for one preset (delete-then-insert), inside an existing transaction. */
export function replacePresetSegments(tx: Tx, presetId: string, ranges: TimeRange[]): void {
  tx.delete(presetTimeSegments).where(eq(presetTimeSegments.presetId, presetId)).run();
  if (ranges.length > 0) {
    tx.insert(presetTimeSegments)
      .values(ranges.map((r) => ({ presetId, startTime: r.startTime, endTime: r.endTime })))
      .run();
  }
}

/** Attaches each shift's extra segments without N+1 queries. */
export async function withShiftSegments<T extends { id: string }>(
  rows: T[]
): Promise<(T & { segments: TimeRange[] })[]> {
  if (rows.length === 0) return [];

  const allSegments = await db.query.shiftTimeSegments.findMany({
    where: inArray(
      shiftTimeSegments.shiftId,
      rows.map((r) => r.id)
    ),
    orderBy: (segments, { asc }) => [asc(segments.startTime)],
  });

  const byShiftId = new Map<string, TimeRange[]>();
  for (const segment of allSegments) {
    const list = byShiftId.get(segment.shiftId) ?? [];
    list.push({ startTime: segment.startTime, endTime: segment.endTime });
    byShiftId.set(segment.shiftId, list);
  }

  return rows.map((row) => ({ ...row, segments: byShiftId.get(row.id) ?? [] }));
}

/** Attaches each preset's extra segments without N+1 queries. */
export async function withPresetSegments<T extends { id: string }>(
  rows: T[]
): Promise<(T & { segments: TimeRange[] })[]> {
  if (rows.length === 0) return [];

  const allSegments = await db.query.presetTimeSegments.findMany({
    where: inArray(
      presetTimeSegments.presetId,
      rows.map((r) => r.id)
    ),
    orderBy: (segments, { asc }) => [asc(segments.startTime)],
  });

  const byPresetId = new Map<string, TimeRange[]>();
  for (const segment of allSegments) {
    const list = byPresetId.get(segment.presetId) ?? [];
    list.push({ startTime: segment.startTime, endTime: segment.endTime });
    byPresetId.set(segment.presetId, list);
  }

  return rows.map((row) => ({ ...row, segments: byPresetId.get(row.id) ?? [] }));
}
```

Note: `tx.delete(...).run()` / `.insert(...).run()` — the `better-sqlite3` Drizzle driver's synchronous query builder exposes `.run()` for statements without a `.returning()`; existing transaction code in `app/api/calendars/route.ts` uses the same synchronous `db.transaction((tx) => {...})` shape without `await` inside.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. If `Tx` inference fails, replace it with the exact type Drizzle exports for a better-sqlite3 transaction callback parameter (check `app/api/calendars/route.ts`'s `db.transaction((tx) => {` for the inferred type via hover/`tsc`, since that file already uses one) rather than leaving `tx: any`.

- [ ] **Step 3: Commit**

```bash
git add lib/shift-time-ranges.ts
git commit -m "feat: add server-side segment persistence helpers"
```

---

### Task 4: Shifts API — read, create, update

**Files:**
- Modify: `app/api/shifts/route.ts`
- Modify: `app/api/shifts/[id]/route.ts`

**Interfaces:**
- Consumes: `toTimeRanges`, `validateTimeRanges` (`lib/time-ranges.ts`); `replaceShiftSegments`, `withShiftSegments` (`lib/shift-time-ranges.ts`).
- Produces: shift API responses gain `segments: TimeRange[]`; `POST`/`PUT` accept an optional `segments` field in the body.

- [ ] **Step 1: `GET /api/shifts` — attach segments**

In `app/api/shifts/route.ts`, wrap both returned results through `withShiftSegments`. Replace:

```ts
      const result = await query.where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startOfDay),
          lte(shifts.date, endOfDay),
          or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
        )
      );
      return NextResponse.json(await withSignups(result));
    }

    const result = await query.where(
      and(
        eq(shifts.calendarId, calendarId),
        or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
      )
    );
    return NextResponse.json(await withSignups(result));
```

with:

```ts
      const result = await query.where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startOfDay),
          lte(shifts.date, endOfDay),
          or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
        )
      );
      return NextResponse.json(await withShiftSegments(await withSignups(result)));
    }

    const result = await query.where(
      and(
        eq(shifts.calendarId, calendarId),
        or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
      )
    );
    return NextResponse.json(await withShiftSegments(await withSignups(result)));
```

Add the import:

```ts
import { withShiftSegments, replaceShiftSegments, withPresetSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
```

(`withPresetSegments` is needed in Step 2 below, for reading a preset's own segments when stamping.)

- [ ] **Step 2: `POST /api/shifts` — validate and persist segments**

Replace the body destructuring:

```ts
    const {
      calendarId,
      date,
      startTime,
      endTime,
      title,
      color,
      notes,
      presetId,
      isAllDay,
      isSecondary,
      signupCapacity,
      signupUserIds,
    } = body;
```

with:

```ts
    const {
      calendarId,
      date,
      startTime,
      endTime,
      title,
      color,
      notes,
      presetId,
      isAllDay,
      isSecondary,
      signupCapacity,
      signupUserIds,
      segments: requestedSegments,
    } = body;
```

Change the `insertValues` block so both branches also produce a `segmentsToPersist: TimeRange[]`. Replace the whole `if (access.can("createShift")) { ... } else { ... }` block with:

```ts
    let insertValues: {
      title: string;
      startTime: string;
      endTime: string;
      color: string;
      notes: string | null;
      isAllDay: boolean;
    };
    let segmentsToPersist: TimeRange[] = [];

    if (access.can("createShift")) {
      if (presetId) {
        const [preset] = await db
          .select()
          .from(shiftPresets)
          .where(
            and(
              eq(shiftPresets.id, presetId),
              eq(shiftPresets.calendarId, calendarId)
            )
          );
        if (!preset) {
          return NextResponse.json(
            { error: "Preset not found" },
            { status: 404 }
          );
        }
      }
      insertValues = {
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color: color || "#3b82f6",
        notes: notes || null,
        isAllDay: isAllDay || false,
      };

      if (!isAllDay) {
        const rawSegments: TimeRange[] = Array.isArray(requestedSegments)
          ? requestedSegments
          : [];
        if (rawSegments.length > 0 && !calendar.splitShiftsEnabled) {
          return NextResponse.json(
            { error: "Split shifts are not enabled for this calendar" },
            { status: 400 }
          );
        }
        const allRanges = toTimeRanges({ ...insertValues, segments: rawSegments });
        const validationError = validateTimeRanges(allRanges);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
        segmentsToPersist = rawSegments;
      }
    } else {
      if (!presetId) {
        return NextResponse.json(
          { error: "presetId is required" },
          { status: 400 }
        );
      }
      const [preset] = await db
        .select()
        .from(shiftPresets)
        .where(
          and(
            eq(shiftPresets.id, presetId),
            eq(shiftPresets.calendarId, calendarId)
          )
        );
      if (!preset) {
        return NextResponse.json(
          { error: "Preset not found" },
          { status: 404 }
        );
      }
      insertValues = {
        title: preset.title,
        startTime: preset.isAllDay ? "00:00" : preset.startTime,
        endTime: preset.isAllDay ? "23:59" : preset.endTime,
        color: preset.color,
        notes: preset.notes,
        isAllDay: preset.isAllDay,
      };
      if (!preset.isAllDay && calendar.splitShiftsEnabled) {
        const [presetWithSegments] = await withPresetSegments([preset]);
        segmentsToPersist = presetWithSegments.segments;
      }
    }
```

- [ ] **Step 3: Persist the shift and its segments in one transaction**

Replace the plain `db.insert(shifts)...returning()` call:

```ts
    const [shift] = await db
      .insert(shifts)
      .values({
        calendarId,
        presetId: presetId || null,
        date: parsedDate,
        ...insertValues,
        isSecondary: isSecondary || false,
        signupCapacity:
          typeof signupCapacity === "number" ? signupCapacity : null,
        createdBy: user?.id ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
```

with:

```ts
    const shift = db.transaction((tx) => {
      const [inserted] = tx
        .insert(shifts)
        .values({
          calendarId,
          presetId: presetId || null,
          date: parsedDate,
          ...insertValues,
          isSecondary: isSecondary || false,
          signupCapacity:
            typeof signupCapacity === "number" ? signupCapacity : null,
          createdBy: user?.id ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
      replaceShiftSegments(tx, inserted.id, segmentsToPersist);
      return inserted;
    });
```

Update the final response to include segments:

```ts
    return NextResponse.json(
      { ...shift, calendar, signups, segments: segmentsToPersist },
      { status: 201 }
    );
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/shifts/route.ts`
Expected: clean (`.returning().get()` is the same synchronous single-row pattern already used in `app/api/calendars/route.ts`'s `db.transaction((tx) => {...})` block).

- [ ] **Step 5: `GET /api/shifts/[id]` — attach segments**

In `app/api/shifts/[id]/route.ts`, add the import `import { withShiftSegments } from "@/lib/shift-time-ranges";` and change the `GET` handler's return:

```ts
    return NextResponse.json(result[0]);
```
to:
```ts
    const [withSegments] = await withShiftSegments([result[0]]);
    return NextResponse.json(withSegments);
```

- [ ] **Step 6: `PUT /api/shifts/[id]` — validate and persist segments on update**

Add imports:

```ts
import { replaceShiftSegments, withShiftSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
```

Before the existing `db.update(shifts)...` call, insert validation and figure out the calendar's `splitShiftsEnabled`:

```ts
    const nextStartTime = body.startTime ?? existingShift.startTime;
    const nextEndTime = body.endTime ?? existingShift.endTime;
    const nextIsAllDay = body.isAllDay ?? existingShift.isAllDay;

    let nextSegments: TimeRange[] | undefined;
    if (body.segments !== undefined) {
      const rawSegments: TimeRange[] = Array.isArray(body.segments) ? body.segments : [];
      if (!nextIsAllDay) {
        const [calendar] = await db
          .select()
          .from(calendars)
          .where(eq(calendars.id, existingShift.calendarId));
        if (rawSegments.length > 0 && !calendar?.splitShiftsEnabled) {
          return NextResponse.json(
            { error: "Split shifts are not enabled for this calendar" },
            { status: 400 }
          );
        }
        const allRanges = toTimeRanges({
          startTime: nextStartTime,
          endTime: nextEndTime,
          segments: rawSegments,
        });
        const validationError = validateTimeRanges(allRanges);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
      }
      nextSegments = nextIsAllDay ? [] : rawSegments;
    }
```

(`calendars` needs to be imported in this file — add it to the existing `import { calendars, shiftPresets, shifts } from "@/lib/db/schema";` line.)

Replace the update call:

```ts
    const [updatedShift] = await db
      .update(shifts)
      .set({
        date,
        startTime: body.startTime ?? existingShift.startTime,
        endTime: body.endTime ?? existingShift.endTime,
        title: body.title ?? existingShift.title,
        color: body.color ?? existingShift.color,
        notes: body.notes ?? existingShift.notes,
        isAllDay: body.isAllDay ?? existingShift.isAllDay,
        presetId: body.presetId ?? existingShift.presetId,
        signupCapacity:
          typeof body.signupCapacity === "number"
            ? body.signupCapacity
            : body.signupCapacity === null
              ? null
              : existingShift.signupCapacity,
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, id))
      .returning();

    return NextResponse.json(updatedShift);
```

with:

```ts
    const updatedShift = db.transaction((tx) => {
      const [updated] = tx
        .update(shifts)
        .set({
          date,
          startTime: nextStartTime,
          endTime: nextEndTime,
          title: body.title ?? existingShift.title,
          color: body.color ?? existingShift.color,
          notes: body.notes ?? existingShift.notes,
          isAllDay: nextIsAllDay,
          presetId: body.presetId ?? existingShift.presetId,
          signupCapacity:
            typeof body.signupCapacity === "number"
              ? body.signupCapacity
              : body.signupCapacity === null
                ? null
                : existingShift.signupCapacity,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, id))
        .returning()
        .get();
      if (nextSegments !== undefined) {
        replaceShiftSegments(tx, id, nextSegments);
      }
      return updated;
    });

    const [withSegments] = await withShiftSegments([updatedShift]);
    return NextResponse.json(withSegments);
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/shifts/[id]/route.ts app/api/shifts/route.ts`
Expected: clean.

- [ ] **Step 8: Manual smoke test against the running dev server**

Run `npm run dev` in the background, then (with a real session cookie or `AUTH_ENABLED=false`) exercise both routes:
```bash
curl -s -X POST http://localhost:3000/api/shifts -H "Content-Type: application/json" \
  -d '{"calendarId":"<id>","date":"2026-09-20","startTime":"06:00","endTime":"10:00","title":"Test","segments":[{"startTime":"15:00","endTime":"21:00"}]}' | jq .
```
Expected: `201`, response contains `startTime: "06:00"`, `endTime: "10:00"`, `segments: [{"startTime":"15:00","endTime":"21:00"}]` — unless the target calendar has `splitShiftsEnabled: false`, in which case expect a `400` with `"Split shifts are not enabled for this calendar"` (this is expected until Task 6 lets you flip the toggle; for now confirm the 400 path works, then re-test the 201 path after Task 6/9 are done and the toggle is on).

- [ ] **Step 9: Commit**

```bash
git add app/api/shifts/route.ts app/api/shifts/[id]/route.ts
git commit -m "feat(api): validate and persist shift time segments"
```

---

### Task 5: Presets API — read, create, update (with cascade)

**Files:**
- Modify: `app/api/presets/route.ts`
- Modify: `app/api/presets/[id]/route.ts`

**Interfaces:**
- Consumes: `toTimeRanges`, `validateTimeRanges` (`lib/time-ranges.ts`); `replacePresetSegments`, `replaceShiftSegments`, `withPresetSegments` (`lib/shift-time-ranges.ts`).
- Produces: preset API responses gain `segments: TimeRange[]`; `POST`/`PATCH` accept an optional `segments` field.

- [ ] **Step 1: `GET /api/presets` — attach segments**

Add import `import { withPresetSegments } from "@/lib/shift-time-ranges";`. Replace:

```ts
    const presets = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.calendarId, calendarId))
      .orderBy(asc(shiftPresets.order));
    return NextResponse.json(presets);
```

with:

```ts
    const presets = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.calendarId, calendarId))
      .orderBy(asc(shiftPresets.order));
    return NextResponse.json(await withPresetSegments(presets));
```

- [ ] **Step 2: `POST /api/presets` — validate and persist segments**

Add imports:

```ts
import { replacePresetSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
```

Extend the destructuring:

```ts
    const {
      calendarId,
      title,
      startTime,
      endTime,
      color,
      notes,
      groupName,
      isSecondary,
      isAllDay,
      hideFromStats,
      defaultSignupCapacity,
      segments: requestedSegments,
    } = body;
```

After the existing calendar fetch and the `createPreset` capability check, before the "max order" block, add:

```ts
    const rawSegments: TimeRange[] = isAllDay || !Array.isArray(requestedSegments)
      ? []
      : requestedSegments;
    if (rawSegments.length > 0 && !calendar.splitShiftsEnabled) {
      return NextResponse.json(
        { error: "Split shifts are not enabled for this calendar" },
        { status: 400 }
      );
    }
    if (!isAllDay) {
      const validationError = validateTimeRanges(
        toTimeRanges({ startTime, endTime, segments: rawSegments })
      );
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }
```

Replace the insert call:

```ts
    const [preset] = await db
      .insert(shiftPresets)
      .values({
        calendarId,
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color: color || "#3b82f6",
        notes: notes || null,
        groupName: groupName ? trimOrNull(groupName) : null,
        isSecondary: isSecondary || false,
        isAllDay: isAllDay || false,
        hideFromStats: hideFromStats || false,
        defaultSignupCapacity:
          typeof defaultSignupCapacity === "number"
            ? defaultSignupCapacity
            : null,
        order: maxOrder + 1,
        createdBy: user?.id ?? null,
      })
      .returning();

    return NextResponse.json(preset);
```

with:

```ts
    const preset = db.transaction((tx) => {
      const [inserted] = tx
        .insert(shiftPresets)
        .values({
          calendarId,
          title,
          startTime: isAllDay ? "00:00" : startTime,
          endTime: isAllDay ? "23:59" : endTime,
          color: color || "#3b82f6",
          notes: notes || null,
          groupName: groupName ? trimOrNull(groupName) : null,
          isSecondary: isSecondary || false,
          isAllDay: isAllDay || false,
          hideFromStats: hideFromStats || false,
          defaultSignupCapacity:
            typeof defaultSignupCapacity === "number"
              ? defaultSignupCapacity
              : null,
          order: maxOrder + 1,
          createdBy: user?.id ?? null,
        })
        .returning()
        .get();
      replacePresetSegments(tx, inserted.id, rawSegments);
      return inserted;
    });

    return NextResponse.json({ ...preset, segments: rawSegments });
```

Add `import { db } from "@/lib/db";` at the top if not already present (it already is — `db` is imported on line 2 of this file).

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/presets/route.ts`
Expected: clean.

- [ ] **Step 4: `PATCH /api/presets/[id]` — validate, persist, and cascade to child shifts**

Add imports to `app/api/presets/[id]/route.ts`:

```ts
import { replacePresetSegments, replaceShiftSegments, withPresetSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
```

Extend the destructuring in `PATCH`:

```ts
    const {
      title,
      startTime,
      endTime,
      color,
      notes,
      groupName,
      isSecondary,
      isAllDay,
      hideFromStats,
      defaultSignupCapacity,
      segments: requestedSegments,
    } = body;
```

After the existing permission check (`hasAccess` for `manageOwnPresets`/`manageAnyPresets`) and before the update call, add:

```ts
    const nextIsAllDay = isAllDay !== undefined ? isAllDay : existingPreset.isAllDay;
    let nextSegments: TimeRange[] | undefined;
    if (requestedSegments !== undefined) {
      const rawSegments: TimeRange[] = Array.isArray(requestedSegments) ? requestedSegments : [];
      if (!nextIsAllDay) {
        if (rawSegments.length > 0 && !calendar.splitShiftsEnabled) {
          return NextResponse.json(
            { error: "Split shifts are not enabled for this calendar" },
            { status: 400 }
          );
        }
        const validationError = validateTimeRanges(
          toTimeRanges({
            startTime: startTime ?? existingPreset.startTime,
            endTime: endTime ?? existingPreset.endTime,
            segments: rawSegments,
          })
        );
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
      }
      nextSegments = nextIsAllDay ? [] : rawSegments;
    }
```

Replace the two existing update calls (preset row + cascaded shifts) with a single transaction that also cascades segments:

```ts
    const updatedPreset = db.transaction((tx) => {
      const [updated] = tx
        .update(shiftPresets)
        .set({
          title,
          startTime: isAllDay ? "00:00" : startTime,
          endTime: isAllDay ? "23:59" : endTime,
          color,
          notes: notes || null,
          groupName: normalizedGroupName,
          isSecondary: isSecondary !== undefined ? isSecondary : undefined,
          isAllDay: isAllDay !== undefined ? isAllDay : undefined,
          hideFromStats: hideFromStats !== undefined ? hideFromStats : undefined,
          defaultSignupCapacity:
            defaultSignupCapacity !== undefined
              ? defaultSignupCapacity
              : undefined,
          updatedAt: new Date(),
        })
        .where(eq(shiftPresets.id, id))
        .returning()
        .get();

      if (nextSegments !== undefined) {
        replacePresetSegments(tx, id, nextSegments);
      }

      // Cascade to every shift created from this preset — title/time/color/
      // notes/isAllDay are already cascaded unconditionally below; segments
      // must follow the same rule so a preset's split-shift edit doesn't
      // silently stop propagating to shifts already created from it.
      const childShifts = tx
        .select({ id: shifts.id })
        .from(shifts)
        .where(
          and(
            eq(shifts.presetId, id),
            eq(shifts.calendarId, existingPreset.calendarId)
          )
        )
        .all();

      tx.update(shifts)
        .set({
          title,
          startTime: isAllDay ? "00:00" : startTime,
          endTime: isAllDay ? "23:59" : endTime,
          color,
          notes: notes || null,
          isAllDay: isAllDay !== undefined ? isAllDay : undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shifts.presetId, id),
            eq(shifts.calendarId, existingPreset.calendarId)
          )
        )
        .run();

      if (nextSegments !== undefined) {
        for (const child of childShifts) {
          replaceShiftSegments(tx, child.id, nextSegments);
        }
      }

      return updated;
    });

    const [withSegments] = await withPresetSegments([updatedPreset]);
    return NextResponse.json(withSegments);
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/presets/[id]/route.ts`
Expected: clean.

- [ ] **Step 6: Manual smoke test**

With the dev server running, create a preset with two ranges, create a shift from it, then PATCH the preset's segments and confirm the shift picks up the new segments:
```bash
curl -s -X PATCH http://localhost:3000/api/presets/<presetId> -H "Content-Type: application/json" \
  -d '{"title":"Frühdienst","startTime":"06:00","endTime":"10:00","color":"#3b82f6","segments":[{"startTime":"14:00","endTime":"18:00"}]}' | jq .segments
curl -s http://localhost:3000/api/shifts/<childShiftId> | jq .segments
```
Expected: both print `[{"startTime":"14:00","endTime":"18:00"}]`.

- [ ] **Step 7: Commit**

```bash
git add app/api/presets/route.ts app/api/presets/[id]/route.ts
git commit -m "feat(api): validate, persist, and cascade preset time segments"
```

---

### Task 6: Calendars API — the `splitShiftsEnabled` toggle

**Files:**
- Modify: `app/api/calendars/route.ts`
- Modify: `app/api/calendars/[id]/route.ts`

**Interfaces:**
- Produces: `GET /api/calendars` rows include `splitShiftsEnabled`; `PATCH /api/calendars/[id]` accepts and persists `splitShiftsEnabled`.

- [ ] **Step 1: Include the field in the calendars list select**

In `app/api/calendars/route.ts`, in the `.select({...})` block, add the field next to `signupsEnabled`:

```ts
        signupsEnabled: calendars.signupsEnabled,
        splitShiftsEnabled: calendars.splitShiftsEnabled,
```

- [ ] **Step 2: Accept and persist it in the PATCH route**

In `app/api/calendars/[id]/route.ts`, extend the destructuring:

```ts
    const { name, color, guestBundleId, viewSettings, signupsEnabled, splitShiftsEnabled } = body;
```

Extend `wantsGeneralChange` so the permission gate also covers this field:

```ts
    const wantsGeneralChange =
      name !== undefined ||
      color !== undefined ||
      viewSettings !== undefined ||
      typeof signupsEnabled === "boolean" ||
      typeof splitShiftsEnabled === "boolean";
```

Add the write, mirroring the `signupsEnabled` block exactly:

```ts
    if (
      typeof splitShiftsEnabled === "boolean" &&
      splitShiftsEnabled !== existingCalendar.splitShiftsEnabled
    ) {
      updateData.splitShiftsEnabled = splitShiftsEnabled;
      changes.push("splitShiftsEnabled");
    }
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/calendars/route.ts app/api/calendars/[id]/route.ts`
Expected: clean.

- [ ] **Step 4: Manual smoke test**

```bash
curl -s -X PATCH http://localhost:3000/api/calendars/<id> -H "Content-Type: application/json" \
  -d '{"splitShiftsEnabled": true}' | jq .splitShiftsEnabled
```
Expected: `true`. Re-run Task 4 Step 8's `curl` against a shift on this same calendar — it should now return `201` instead of `400`.

- [ ] **Step 5: Commit**

```bash
git add app/api/calendars/route.ts "app/api/calendars/[id]/route.ts"
git commit -m "feat(api): add splitShiftsEnabled calendar toggle"
```

---

### Task 7: Duration and display helpers (incl. stats)

**Files:**
- Modify: `lib/shift-display.ts`
- Modify: `app/api/shifts/stats/route.ts`

**Interfaces:**
- Consumes: `toTimeRanges`, `sumRangeDurations` from `lib/time-ranges.ts`.
- Produces: `formatTimeRange()` now joins multiple ranges; `getShiftMinutes()` now sums across segments.

- [ ] **Step 1: Update `formatTimeRange` and `getShiftMinutes` in `lib/shift-display.ts`**

Add the import: `import { toTimeRanges, sumRangeDurations } from "@/lib/time-ranges";`

Replace:

```ts
export function getShiftMinutes(shift: ShiftWithCalendar): number {
  return shift.isAllDay
    ? 0
    : calculateShiftDuration(shift.startTime, shift.endTime);
}
```

with:

```ts
export function getShiftMinutes(shift: ShiftWithCalendar): number {
  return shift.isAllDay ? 0 : sumRangeDurations(toTimeRanges(shift));
}
```

Replace:

```ts
export function formatTimeRange(times: {
  startTime: string;
  endTime: string;
}): string {
  return `${times.startTime.slice(0, 5)} – ${times.endTime.slice(0, 5)}`;
}
```

with:

```ts
export function formatTimeRange(times: {
  startTime: string;
  endTime: string;
  segments?: { startTime: string; endTime: string }[];
}): string {
  return toTimeRanges(times)
    .map((range) => `${range.startTime.slice(0, 5)} – ${range.endTime.slice(0, 5)}`)
    .join(", ");
}
```

`calculateShiftDuration` is still imported and used elsewhere in this file (e.g. nowhere else currently, so if `tsc`/lint flags it as unused after this change, remove the now-unused import — check with the next step).

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint lib/shift-display.ts`
Expected: clean; if `calculateShiftDuration` is now unused in this file, remove its import.

- [ ] **Step 3: Update the stats route to sum segments**

In `app/api/shifts/stats/route.ts`, add imports:

```ts
import { withShiftSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, sumRangeDurations } from "@/lib/time-ranges";
```

After the existing `result` query (the `.select({...}).from(shifts)...` call that selects `id, title, date, startTime, endTime, isAllDay`), attach segments:

```ts
    const resultWithSegments = await withShiftSegments(result);
```

Replace the duration line inside the `result.forEach((shift) => { ... })` loop — change `result.forEach` to `resultWithSegments.forEach`, and replace:

```ts
      const duration = shift.isAllDay
        ? 0
        : calculateShiftDuration(shift.startTime, shift.endTime);
```

with:

```ts
      const duration = shift.isAllDay ? 0 : sumRangeDurations(toTimeRanges(shift));
```

Also change the later `const totalShifts = result.length;` to `const totalShifts = resultWithSegments.length;` (same value, just keeping the variable name consistent with the renamed source array — check every other bare `result` reference in this file with `grep -n "\bresult\b" app/api/shifts/stats/route.ts` and rename them all to `resultWithSegments` so nothing silently keeps reading the pre-segments array).

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/shifts/stats/route.ts`
Expected: clean, no leftover references to the old `result` variable name.

- [ ] **Step 5: Manual smoke test**

```bash
curl -s "http://localhost:3000/api/shifts/stats?calendarId=<id>&period=month" | jq '.totalMinutes, .stats'
```
For a calendar with one split shift (`06:00–10:00` + `15:00–21:00` = 240 + 360 = 600 minutes) and nothing else in the period, expect `totalMinutes: 600`.

- [ ] **Step 6: Commit**

```bash
git add lib/shift-display.ts app/api/shifts/stats/route.ts
git commit -m "feat: sum split-shift durations in display helpers and stats"
```

---

### Task 8: PDF and ICS exports

**Files:**
- Modify: `app/api/export/pdf/route.ts`
- Modify: `app/api/export/ics/route.ts`

**Interfaces:**
- Consumes: `formatTimeRange` (`lib/shift-display.ts`) for PDF; `toTimeRanges` (`lib/time-ranges.ts`) for ICS.

- [ ] **Step 1: PDF — join ranges**

Both `app/api/export/pdf/route.ts` and `app/api/export/ics/route.ts` use `db.query.shifts.findMany(...)` (the Drizzle relational API), so they can request the relation directly instead of a separate helper call. In `app/api/export/pdf/route.ts`, change the shifts query:

```ts
    let allShifts = await db.query.shifts.findMany({
      where: inArray(
        shifts.calendarId,
        accessibleCalendars.map((c) => c.id)
      ),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
    });
```

to:

```ts
    let allShifts = await db.query.shifts.findMany({
      where: inArray(
        shifts.calendarId,
        accessibleCalendars.map((c) => c.id)
      ),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
      with: { segments: true },
    });
```

Add the import `import { formatTimeRange } from "@/lib/shift-display";` and replace:

```ts
          const timeStr = shift.isAllDay
            ? "—" // Em dash for all-day shifts
            : `${shift.startTime} - ${shift.endTime}`;
```

with:

```ts
          const timeStr = shift.isAllDay ? "—" : formatTimeRange(shift);
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/export/pdf/route.ts`
Expected: clean.

- [ ] **Step 3: ICS — one VEVENT per range**

In `app/api/export/ics/route.ts`, change the shifts query the same way:

```ts
    const allShifts = await db.query.shifts.findMany({
      where: inArray(
        shifts.calendarId,
        accessibleCalendars.map((c) => c.id)
      ),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
      with: { segments: true },
    });
```

Add the import `import { toTimeRanges } from "@/lib/time-ranges";`. Replace the whole `for (const shift of allShifts) { ... }` body's event-creation section — everything from `const vevent = new ICAL.Component("vevent");` through `cal.addSubcomponent(vevent);` — with a loop over ranges that shares the shift's summary/description/color but gives each range its own VEVENT:

```ts
    for (const shift of allShifts) {
      const shiftDate = shift.date as Date;
      const calendarName = calendarMap.get(shift.calendarId);
      const summary = isMultiCalendar
        ? `[${calendarName}] ${shift.title}`
        : shift.title;

      const ranges = shift.isAllDay ? [null] : toTimeRanges(shift);

      ranges.forEach((range, index) => {
        const vevent = new ICAL.Component("vevent");
        const event = new ICAL.Event(vevent);

        event.uid = index === 0 ? shift.id : `${shift.id}-seg-${index}`;
        event.summary = summary;
        if (shift.notes) {
          event.description = shift.notes;
        }

        if (!range) {
          // All-day event (DTEND is exclusive per RFC 5545)
          const dateStr = formatDateToLocal(shiftDate);
          event.startDate = ICAL.Time.fromDateString(dateStr);

          const endDate = new Date(shiftDate);
          endDate.setDate(endDate.getDate() + 1);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
          const endDay = String(endDate.getDate()).padStart(2, "0");
          event.endDate = ICAL.Time.fromDateString(`${endYear}-${endMonth}-${endDay}`);
        } else {
          const [startHour, startMinute] = range.startTime.split(":").map(Number);
          const [endHour, endMinute] = range.endTime.split(":").map(Number);

          const startDateTime = new Date(shiftDate);
          startDateTime.setHours(startHour, startMinute, 0, 0);

          const endDateTime = new Date(shiftDate);
          endDateTime.setHours(endHour, endMinute, 0, 0);

          if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
          }

          event.startDate = ICAL.Time.fromJSDate(startDateTime, true);
          event.endDate = ICAL.Time.fromJSDate(endDateTime, true);
        }

        vevent.addPropertyWithValue("color", shift.color);
        vevent.addPropertyWithValue("x-apple-calendar-color", shift.color);

        cal.addSubcomponent(vevent);
      });
    }
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/export/ics/route.ts`
Expected: clean.

- [ ] **Step 5: Manual smoke test**

```bash
curl -s -X POST http://localhost:3000/api/export/ics -H "Content-Type: application/json" \
  -d '{"calendarIds":["<id>"]}' -o /tmp/test-export.ics
grep -c BEGIN:VEVENT /tmp/test-export.ics
```
For a calendar with one split shift (2 ranges) and nothing else, expect `2`.

- [ ] **Step 6: Commit**

```bash
git add app/api/export/pdf/route.ts app/api/export/ics/route.ts
git commit -m "feat(export): render split-shift ranges in PDF and ICS exports"
```

---

### Task 9: Calendar settings UI toggle + its i18n keys

**Files:**
- Modify: `components/calendar-permissions-panel.tsx`
- Modify: `messages/de.json`, `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/cs.json`

**Interfaces:**
- Consumes: `useCalendars().updateCalendar` (already handles arbitrary `CalendarUpdateInput` fields), `ToggleRow`/`InfoNote`/`SectionLabel` from `components/form-kit`.

- [ ] **Step 1: Add the i18n keys to `messages/de.json`**

Find the `sharingSheet` object (it already has `signupsEnabledLabel`/`signupsEnabledDesc`) and add, next to those two keys:

```json
    "splitShiftsEnabledLabel": "Geteilte Dienste aktivieren",
    "splitShiftsEnabledDesc": "Erlaubt mehrere Zeitfenster in einer Schicht oder Vorlage, z. B. 06:00–10:00 und 15:00–21:00. Ausgeschaltet werden zusätzliche Zeitfenster überall ausgeblendet.",
```

Find the `permissionBundles` object (it has `groups.signups`, `signupsLocked`, `signupsCapabilityHint`) and add:

```json
    "splitShiftsLocked": "Nur wer Kalendereinstellungen verwalten darf, kann geteilte Dienste ein- oder ausschalten.",
```

and inside its nested `groups` object, next to `"signups": "Anmeldungen"`:

```json
      "splitShifts": "Geteilte Dienste",
```

- [ ] **Step 2: Mirror the same keys into the other 5 locale files**

For each of `en.json`, `es.json`, `fr.json`, `it.json`, `cs.json`, add the same three keys (`sharingSheet.splitShiftsEnabledLabel`, `sharingSheet.splitShiftsEnabledDesc`, `permissionBundles.splitShiftsLocked`, `permissionBundles.groups.splitShifts`) at the same nesting depth, translated. English (`en.json`) reference translation:

```json
    "splitShiftsEnabledLabel": "Enable split shifts",
    "splitShiftsEnabledDesc": "Allows multiple time ranges in one shift or preset, e.g. 06:00–10:00 and 15:00–21:00. Turning this off hides extra time ranges everywhere.",
```
```json
    "splitShiftsLocked": "Only someone who can manage calendar settings can turn split shifts on or off.",
```
```json
      "splitShifts": "Split shifts",
```

Translate the same meaning into `es.json`, `fr.json`, `it.json`, `cs.json` following each file's existing tone for the neighboring `signupsEnabled*`/`signupsLocked`/`groups.signups` keys (open each file, find those keys, and match register/formality).

- [ ] **Step 3: Run the i18n check**

Run: `npm run i18n`
Expected: no missing/unused key errors for the six new keys.

- [ ] **Step 4: Add the toggle UI**

In `components/calendar-permissions-panel.tsx`, add local state next to `optimisticSignupsEnabled`:

```ts
  const [optimisticSplitShiftsEnabled, setOptimisticSplitShiftsEnabled] = useState<boolean | null>(null);
```

Right after `const signupsEnabled = ...` line, add:

```ts
  const splitShiftsEnabled =
    optimisticSplitShiftsEnabled ?? calendar?.splitShiftsEnabled ?? false;
```

Right after `handleSignupsEnabledChange`, add the matching handler:

```ts
  const handleSplitShiftsEnabledChange = async (value: boolean) => {
    if (value === splitShiftsEnabled) return;
    setOptimisticSplitShiftsEnabled(value);
    setSaving(true);
    try {
      await updateCalendar(calendarId, { splitShiftsEnabled: value });
    } catch {
      // updateCalendar already reported the error and rolled back the cache.
    } finally {
      setSaving(false);
      setOptimisticSplitShiftsEnabled(null);
    }
  };
```

Right after the existing signups `<section>` block (the one ending with `</section>` that contains the `signups-enabled` `ToggleRow`), add a second section:

```tsx
            <section className="flex flex-col gap-3 border-t border-line pt-5">
              <SectionLabel className="mb-0">{t("permissionBundles.groups.splitShifts")}</SectionLabel>
              <ToggleRow
                id="split-shifts-enabled"
                title={t("sharingSheet.splitShiftsEnabledLabel")}
                description={t("sharingSheet.splitShiftsEnabledDesc")}
                checked={splitShiftsEnabled}
                onCheckedChange={handleSplitShiftsEnabledChange}
                disabled={saving || !canManageSettings}
              />
              {!canManageSettings && (
                <InfoNote icon={Lock}>{t("permissionBundles.splitShiftsLocked")}</InfoNote>
              )}
            </section>
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/calendar-permissions-panel.tsx`
Expected: clean.

- [ ] **Step 6: Manual verification in the browser**

With `npm run dev` running, open the app, go to a calendar's permissions/sharing panel, confirm the new "Geteilte Dienste" section renders below "Anmeldungen" with a working toggle (disabled for non-managers, saving state visible while in flight).

- [ ] **Step 7: Commit**

```bash
git add components/calendar-permissions-panel.tsx messages/*.json
git commit -m "feat(ui): add split-shifts calendar toggle"
```

---

### Task 10: Shift form — segment editor

**Files:**
- Modify: `components/shift-sheet.tsx`
- Modify: `components/shift-form-fields.tsx`
- Modify: `hooks/useShiftForm.ts`
- Modify: `hooks/useShifts.ts`
- Modify: `messages/de.json`, `messages/en.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/cs.json`

**Interfaces:**
- Consumes: `TimeRange`, `validateTimeRanges` (`lib/time-ranges.ts`); `useCalendars` for `calendar.splitShiftsEnabled`.
- Produces: `ShiftFormData.segments: TimeRange[]`.

- [ ] **Step 1: Add the i18n keys**

In `messages/de.json`, add a new top-level `timeRanges` object (place it alphabetically near `shiftSheet`/`shiftSignup`):

```json
  "timeRanges": {
    "add": "Zeitfenster hinzufügen",
    "remove": "Zeitfenster entfernen",
    "errors": {
      "overlap": "Zeitfenster dürfen sich nicht überschneiden.",
      "overnight_segment": "Bei mehreren Zeitfenstern muss jedes am selben Tag enden.",
      "invalid_format": "Ungültige Uhrzeit."
    }
  },
```

Mirror into the other five locale files, e.g. `en.json`:

```json
  "timeRanges": {
    "add": "Add time range",
    "remove": "Remove time range",
    "errors": {
      "overlap": "Time ranges must not overlap.",
      "overnight_segment": "With multiple time ranges, each one must end on the same day.",
      "invalid_format": "Invalid time."
    }
  },
```

Translate the same three error keys plus `add`/`remove` into `es.json`, `fr.json`, `it.json`, `cs.json`.

Run: `npm run i18n` — expect no missing-key errors (there will be "unused key" warnings until Step 4 below wires up the actual `t()` calls; that's expected mid-task, resolve by the end of this task).

- [ ] **Step 2: `ShiftFormData` gains `segments`**

In `components/shift-sheet.tsx`, add the field:

```ts
export interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  color?: string;
  notes?: string;
  presetId?: string;
  isAllDay?: boolean;
  signupCapacity?: number | null;
  segments?: TimeRange[];
  signupUserIds?: string[];
}
```

Add the import `import type { TimeRange } from "@/lib/time-ranges";`.

Update `snapshot()` to include it in the dirty-check:

```ts
function snapshot(data: ShiftFormData) {
  return JSON.stringify({
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    title: data.title,
    notes: data.notes || "",
    color: data.color,
    isAllDay: data.isAllDay || false,
    signupCapacity: data.signupCapacity ?? null,
    segments: data.segments ?? [],
  });
}
```

Update `initialSnapshot`'s object literal (inside the `useMemo`) to also pass `segments: shift.segments ?? []`.

- [ ] **Step 3: `useShiftForm.ts` manages `segments` in form state**

Add the import `import type { TimeRange } from "@/lib/time-ranges";`. In every place `useState<ShiftFormData>` initializes or `resetForm`/`clearPreset`/`applyPreset` rebuild the object, add `segments: shift?.segments ?? []` (for the initial state and the `open`-effect branch) or `segments: []` (for `resetForm`/`clearPreset`) or `segments: preset.segments ?? []` (for `applyPreset` — the `ShiftPreset` type doesn't carry `segments` by default since it's a joined field, so widen `applyPreset`'s parameter type from `ShiftPreset` to `ShiftPreset & { segments?: TimeRange[] }`).

Concretely:
- Initial `useState<ShiftFormData>(...)`: add `segments: shift?.segments ?? [],`
- `applyPreset`: change signature to `(preset: ShiftPreset & { segments?: TimeRange[] })` and add `segments: preset.segments ?? [],` to the `setFormData` call.
- `clearPreset`: add `segments: [],`
- `resetForm`: add `segments: [],`
- The `open`-effect's `newFormData` object: add `segments: shift?.segments ?? [],`, and add `formDataRef.current.segments !== newFormData.segments` is wrong for arrays — instead add a length+content check: extend `needsUpdate` with ``JSON.stringify(formDataRef.current.segments ?? []) !== JSON.stringify(newFormData.segments ?? [])``.

- [ ] **Step 4: `ShiftFormFields` — render the segment editor**

Add imports:

```ts
import { validateTimeRanges, toTimeRanges, type TimeRange } from "@/lib/time-ranges";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
```

Add a new prop `splitShiftsEnabled?: boolean` to `ShiftFormFieldsProps`.

Right after the existing start/end/duration `<div className="flex gap-2.5">` block (still inside the `<div className="flex flex-col gap-2.5 lg:gap-3">` wrapper, before the `<CheckRow id="allDay" ...>`), add:

```tsx
        {!formData.isAllDay && (formData.segments?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2">
            {(formData.segments ?? []).map((segment, index) => (
              <div key={index} className="flex items-end gap-2.5">
                <Field label={t("shiftSheet.start")} className="flex-1">
                  <Input
                    type="time"
                    value={segment.startTime}
                    onChange={(e) => {
                      const next = [...(formData.segments ?? [])];
                      next[index] = { ...next[index], startTime: e.target.value };
                      onFormDataChange({ ...formData, segments: next });
                    }}
                    disabled={readOnly}
                    className={cn(inputClass, "font-mono")}
                  />
                </Field>
                <Field label={t("shiftSheet.end")} className="flex-1">
                  <Input
                    type="time"
                    value={segment.endTime}
                    onChange={(e) => {
                      const next = [...(formData.segments ?? [])];
                      next[index] = { ...next[index], endTime: e.target.value };
                      onFormDataChange({ ...formData, segments: next });
                    }}
                    disabled={readOnly}
                    className={cn(inputClass, "font-mono")}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mb-[1px] shrink-0"
                  aria-label={t("timeRanges.remove")}
                  disabled={readOnly}
                  onClick={() => {
                    const next = (formData.segments ?? []).filter((_, i) => i !== index);
                    onFormDataChange({ ...formData, segments: next });
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!formData.isAllDay && splitShiftsEnabled && !readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              onFormDataChange({
                ...formData,
                segments: [...(formData.segments ?? []), { startTime: "12:00", endTime: "14:00" }],
              })
            }
          >
            <Plus className="size-4" />
            {t("timeRanges.add")}
          </Button>
        )}

        {!formData.isAllDay &&
          (() => {
            const error = validateTimeRanges(toTimeRanges(formData));
            return error ? (
              <p className="text-[13px] text-destructive">{t(`timeRanges.errors.${error}`)}</p>
            ) : null;
          })()}
```

Check the exact class name this codebase uses for inline validation-error text (grep `text-destructive` or similar across `components/*.tsx` — e.g. `grep -rn "text-destructive\|text-error\|text-danger" components | head -5`) and use that project's existing error-text class instead of guessing, if it differs.

- [ ] **Step 5: Thread `splitShiftsEnabled` from `ShiftSheet`**

In `components/shift-sheet.tsx`, add `import { useCalendars } from "@/hooks/useCalendars";`. Inside the `ShiftSheet` component, after `const permission = useCalendarPermission(calendarId);`, add:

```ts
  const { calendars } = useCalendars();
  const splitShiftsEnabled = calendars.find((c) => c.id === calendarId)?.splitShiftsEnabled ?? false;
```

Pass it to `<ShiftFormFields ... splitShiftsEnabled={splitShiftsEnabled} />`.

Also update `handleSave`'s `submitData` to pass segments through unchanged for all-day (clear them) shifts:

```ts
      const submitData = {
        ...formData,
        startTime: formData.isAllDay ? "00:00" : formData.startTime,
        endTime: formData.isAllDay ? "23:59" : formData.endTime,
        segments: formData.isAllDay ? [] : formData.segments,
        ...(!shift ? { signupUserIds: pendingSignupUserIds } : {}),
      };
```

Also block saving on a validation error — change `saveDisabled` on `<BaseSheet>`:

```tsx
      saveDisabled={
        !formData.title.trim() ||
        (shift && !hasChanges()) ||
        (!formData.isAllDay && !!validateTimeRanges(toTimeRanges(formData)))
      }
```
(add the same `validateTimeRanges`/`toTimeRanges` import used in Step 4 to this file too).

- [ ] **Step 6: `useShifts.ts` — carry `segments` in the optimistic shift**

Find `createOptimisticShift`-equivalent code inside the `useCreateShift`-style mutation (the block building an optimistic `ShiftWithCalendar` around lines 145-160, referenced by `startTime: formData.startTime, endTime: formData.endTime,`). Add `segments: formData.segments ?? [],` next to those two lines, and do the same in the update mutation's optimistic patch (around lines 255-265).

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/shift-sheet.tsx components/shift-form-fields.tsx hooks/useShiftForm.ts hooks/useShifts.ts`
Expected: clean.

- [ ] **Step 8: Run the i18n check again**

Run: `npm run i18n`
Expected: no missing or unused keys now that `timeRanges.*` is actually referenced from `shift-form-fields.tsx`.

- [ ] **Step 9: Manual browser verification**

With `npm run dev` running and a calendar that has `splitShiftsEnabled: true` (set via the Task 9 UI or a direct `curl` PATCH), open the shift-creation sheet:
- Confirm the "Add time range" button appears and adds a second start/end row.
- Enter an overlapping range and confirm the inline error text appears and Save is disabled.
- Fix the overlap, Save, and confirm the created shift shows both ranges (e.g. via `day-detail.tsx`'s time label).
- Toggle the calendar's split-shifts setting off and confirm the "Add time range" button disappears from a fresh create sheet (existing split shifts stay visible per the spec's "hidden, not deleted" rule — don't expect them to vanish from the grid, since Task 12 changes only the *display* of the primary+segments label, not a filter).

- [ ] **Step 10: Commit**

```bash
git add components/shift-sheet.tsx components/shift-form-fields.tsx hooks/useShiftForm.ts hooks/useShifts.ts messages/*.json
git commit -m "feat(ui): add split-shift time-range editor to the shift form"
```

---

### Task 11: Preset form — segment editor

**Files:**
- Modify: `components/preset-form.tsx`
- Modify: `hooks/usePresets.ts`

**Interfaces:**
- Consumes: `TimeRange`, `validateTimeRanges` (`lib/time-ranges.ts`).
- Produces: `PresetFormData.segments: TimeRange[]`.

- [ ] **Step 1: `PresetFormData` gains `segments`**

In `hooks/usePresets.ts`, add the import `import type { TimeRange } from "@/lib/time-ranges";` and extend:

```ts
export interface PresetFormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  notes: string;
  groupName: string;
  isSecondary: boolean;
  isAllDay: boolean;
  hideFromStats: boolean;
  defaultSignupCapacity?: number | null;
  segments: TimeRange[];
}
```

Update `createOptimisticPreset` to include `segments: formData.segments,` in its returned object (widen its return type to `ShiftPreset & { segments: TimeRange[] }` since the base `ShiftPreset` type has no `segments` field).

- [ ] **Step 2: `EMPTY_PRESET_FORM`, `presetToFormData`, `samePresetForm` in `components/preset-form.tsx`**

Add the import `import type { TimeRange } from "@/lib/time-ranges";`. Update:

```ts
export const EMPTY_PRESET_FORM: PresetFormData = {
  title: "",
  startTime: "09:00",
  endTime: "17:00",
  color: DEFAULT_COLOR,
  notes: "",
  groupName: "",
  isSecondary: false,
  isAllDay: false,
  hideFromStats: false,
  defaultSignupCapacity: null,
  segments: [],
};

export function presetToFormData(preset: ShiftPreset & { segments?: TimeRange[] }): PresetFormData {
  return {
    title: preset.title,
    startTime: preset.startTime,
    endTime: preset.endTime,
    color: preset.color,
    notes: preset.notes || "",
    groupName: preset.groupName || "",
    isSecondary: preset.isSecondary || false,
    isAllDay: preset.isAllDay || false,
    hideFromStats: preset.hideFromStats || false,
    defaultSignupCapacity: preset.defaultSignupCapacity ?? null,
    segments: preset.segments ?? [],
  };
}
```

`samePresetForm` already does a generic `Object.keys(a).every((key) => a[key] === b[key])` — a strict `===` on two array values is always `false` even for equal contents, which would make the form perpetually "dirty" once `segments` is non-empty. Change it to:

```ts
export function samePresetForm(a: PresetFormData, b: PresetFormData): boolean {
  const { segments: segmentsA, ...restA } = a;
  const { segments: segmentsB, ...restB } = b;
  return (
    (Object.keys(restA) as (keyof typeof restA)[]).every((key) => restA[key] === restB[key]) &&
    JSON.stringify(segmentsA) === JSON.stringify(segmentsB)
  );
}
```

- [ ] **Step 3: Render the segment editor in `PresetFormCard`**

Add the prop `splitShiftsEnabled?: boolean` to `PresetFormCardProps`. Add imports:

```ts
import { validateTimeRanges, toTimeRanges } from "@/lib/time-ranges";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
```

Right after the existing `{!value.isAllDay && (<div className="grid grid-cols-2 gap-2.5">...</div>)}` start/end block, add:

```tsx
      {!value.isAllDay && value.segments.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.segments.map((segment, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2.5">
              <Field label={t("presetSheet.start")}>
                <Input
                  type="time"
                  value={segment.startTime}
                  onChange={(e) => {
                    const next = [...value.segments];
                    next[index] = { ...next[index], startTime: e.target.value };
                    onChange({ segments: next });
                  }}
                  className={cn(fieldClass, "font-mono")}
                  disabled={disabled}
                />
              </Field>
              <Field label={t("presetSheet.end")}>
                <Input
                  type="time"
                  value={segment.endTime}
                  onChange={(e) => {
                    const next = [...value.segments];
                    next[index] = { ...next[index], endTime: e.target.value };
                    onChange({ segments: next });
                  }}
                  className={cn(fieldClass, "font-mono")}
                  disabled={disabled}
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("timeRanges.remove")}
                disabled={disabled}
                onClick={() => onChange({ segments: value.segments.filter((_, i) => i !== index) })}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!value.isAllDay && splitShiftsEnabled && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            onChange({ segments: [...value.segments, { startTime: "12:00", endTime: "14:00" }] })
          }
        >
          <Plus className="size-4" />
          {t("timeRanges.add")}
        </Button>
      )}

      {!value.isAllDay &&
        (() => {
          const error = validateTimeRanges(toTimeRanges(value));
          return error ? <p className="text-[13px] text-destructive">{t(`timeRanges.errors.${error}`)}</p> : null;
        })()}
```

- [ ] **Step 4: Thread `splitShiftsEnabled` and prevent saving on validation error**

`components/preset-manage-sheet.tsx` renders `<PresetFormCard>` (around line 225) and already has `calendarId` as a prop. Add the import `import { useCalendars } from "@/hooks/useCalendars";` and `import { validateTimeRanges, toTimeRanges } from "@/lib/time-ranges";`, then inside the `PresetsPanel` component add:

```ts
  const { calendars } = useCalendars();
  const splitShiftsEnabled = calendars.find((c) => c.id === calendarId)?.splitShiftsEnabled ?? false;
```

Pass it to the card: `<PresetFormCard ... splitShiftsEnabled={splitShiftsEnabled} />`.

Extend the existing `canSave` line:

```ts
  const canSave =
    !isSaving &&
    formData.title.trim() !== "" &&
    (!editingPreset || isDirty) &&
    (formData.isAllDay || !validateTimeRanges(toTimeRanges(formData)));
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/preset-form.tsx hooks/usePresets.ts`
Expected: clean. Also grep for any other direct `PresetFormData` literal construction that would now be missing the required `segments` field: `grep -rn "PresetFormData = {" components hooks` and `grep -rn ": PresetFormData\b" components hooks` — add `segments: []` (or the real value) everywhere a literal is built without it, since it's a required (non-optional) field.

- [ ] **Step 6: Manual browser verification**

With split shifts enabled on the test calendar, open the preset management sheet, create a preset with two time ranges, save it, confirm it round-trips (reopen and see both ranges). Then create a shift by stamping that preset and confirm the shift got both ranges.

- [ ] **Step 7: Commit**

```bash
git add components/preset-form.tsx hooks/usePresets.ts components/preset-manage-sheet.tsx
git commit -m "feat(ui): add split-shift time-range editor to the preset form"
```

---

### Task 12: Month grid display

**Files:**
- Modify: `components/month-grid.tsx`

**Interfaces:**
- Consumes: `formatTimeRange` (`lib/shift-display.ts`).

- [ ] **Step 1: Use the joined range label in the desktop chip**

Add the import `import { formatTimeRange } from "@/lib/shift-display";` (if not already imported — check the top of the file first). Replace the `time()` helper:

```ts
    const time = (shift: ShiftWithCalendar) => (
      <span className="shrink-0 font-mono text-[10.5px] leading-4 opacity-75">
        {shift.isAllDay ? t("calendarView.allDayShort") : shift.startTime.slice(0, 5)}
      </span>
    );
```

with:

```ts
    const time = (shift: ShiftWithCalendar) => (
      <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] leading-4 opacity-75">
        {shift.isAllDay ? t("calendarView.allDayShort") : formatTimeRange(shift)}
      </span>
    );
```

(`whitespace-nowrap` added because the label can now be longer than a single `HH:MM`; the parent chip is already `flex` with `min-w-0`/`truncate` on the title span, so the row itself will just take the width it needs without wrapping oddly — verify visually in Step 3.)

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/month-grid.tsx`
Expected: clean.

- [ ] **Step 3: Manual browser verification**

With a split shift visible in the month grid on desktop, confirm the chip shows `06:00 – 10:00, 15:00 – 21:00 · <title>` and doesn't visually break the row. Resize to a narrow desktop width and confirm it still truncates gracefully (the title truncates via its own `truncate` class; the time span itself doesn't need to shrink further since chips already wrap to their content). Then switch to a phone-width viewport and confirm the phone chip is unaffected (still shows only the title, no time) — per the spec, no phone-specific change is expected or needed here.

- [ ] **Step 4: Commit**

```bash
git add components/month-grid.tsx
git commit -m "feat(ui): show split-shift ranges in the desktop month grid"
```

---

### Task 13: Full verification and PR

**Files:** none (verification only, plus opening the PR).

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: zero errors across the whole project.

- [ ] **Step 2: Full test pipeline**

Run: `npm test`
Expected: lint, build, and i18n all pass. If the build fails on a client component pulling in `better-sqlite3` (the exact failure mode the client/server split in Task 2/3 was meant to avoid), find which client file imports `lib/shift-time-ranges.ts` (it must only ever be imported from `app/api/**` route files) and fix the import to point at `lib/time-ranges.ts` instead.

- [ ] **Step 3: Migration sanity check on a clean database**

```bash
rm -f data/sqlite.db
npm run db:migrate
```
Expected: exits 0, `data/sqlite.db` is recreated with all tables including `shift_time_segments`, `preset_time_segments`, and `calendars.split_shifts_enabled`. (This only matters for a scratch/dev database — never run this against a database with real data you want to keep.)

- [ ] **Step 4: End-to-end browser walkthrough**

With `npm run dev` running:
1. Log in (or use `AUTH_ENABLED=false`), create a fresh calendar.
2. Open its permissions panel, turn on "Geteilte Dienste".
3. Create a shift with two time ranges (`06:00–10:00`, `15:00–21:00`); confirm it saves and displays both ranges in the month grid and in the day-detail sheet.
4. Create a preset with two ranges, stamp it onto a day, confirm the resulting shift has both ranges.
5. Edit the preset's ranges; confirm the previously stamped shift's ranges update too (the cascade from Task 5).
6. Export that month as PDF and as ICS; open both and confirm the split shift shows both ranges (PDF: one joined line; ICS: two separate events).
7. Turn "Geteilte Dienste" back off; confirm the "Add time range" button disappears from the create-shift sheet, per the spec's "hidden everywhere, not deleted" rule for the calendar-level toggle.
8. Create a normal (non-split) shift on an unrelated, already-existing calendar and confirm nothing about its appearance or behavior changed.

- [ ] **Step 5: Push the branch and open the PR**

```bash
git push -u origin feat/split-shifts
gh pr create --title "feat: support split shifts with multiple time ranges" --body "$(cat <<'EOF'
## Summary
- Shifts and presets can now hold multiple, non-contiguous time ranges on the same day (e.g. 06:00–10:00 and 15:00–21:00), gated per calendar behind a new owner/admin toggle (`splitShiftsEnabled`), off by default.
- Additional ranges live in two new child tables (`shiftTimeSegments`, `presetTimeSegments`); the primary range stays on the existing `startTime`/`endTime` columns for full backward compatibility.
- PDF export joins all ranges into one line; ICS export emits one VEVENT per range.

Closes #191.

## Test plan
- [ ] `npm test` passes (lint, build, i18n)
- [ ] Create/edit a split shift and a split preset in the browser; verify validation (overlap, chronological order) and the calendar-level toggle
- [ ] Verify a preset's segment edits cascade to shifts already created from it
- [ ] Verify PDF and ICS exports for a split shift
- [ ] Verify existing (non-split) shifts/calendars are visually and functionally unchanged
EOF
)"
```

Expected: PR created; report the URL back.
