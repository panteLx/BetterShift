# Custom Fields for Shifts and Presets — Design

Source: GitHub issue [#141](https://github.com/panteLx/BetterShift/issues/141). Shifts and presets carry a fixed set of columns; a team that needs one more piece of information per shift — the on-call phone number in the reporter's case — has no place to put it and currently has to patch `lib/db/schema.ts` plus a dozen call sites by hand.

## Goals

- A calendar owner can define extra, typed fields on their calendar without touching code.
- Shifts and presets carry values for those fields; a preset's value pre-fills a shift created from it.
- Values travel with the shift/preset in the existing API responses, so an API consumer reads `shift.customFields.phone` without a second request.
- Values appear in the shift and preset forms, in the day detail column, in the month and week cells (opt-in), and in the PDF and ICS exports.

## Non-goals

- No instance-wide field catalog. See "Deviation from the issue" below.
- No filtering, grouping or statistics by field value — a follow-up issue.
- No multi-select, textarea, file upload or rich text. Five scalar types only.
- No field values in compare mode.
- No per-user view setting for hiding the values in the month/week grid. `lib/view-settings.ts` is untouched; see "No view setting".
- No changing a field's type after creation.
- External sync is not extended: synced shifts are read-only, and their field values are too.

## Deviation from the issue

The reporter asked for **global, admin-managed** definitions. This design makes them **per calendar, managed via a permission bundle capability** instead.

Everything in BetterShift hangs off `calendarId`. An instance-wide field would appear in every calendar of every user, which is right for a single-tenant company install and wrong for a shared instance hosting unrelated calendars. Per-calendar definitions give the reporter's case the same result — they own their calendars, so they define the fields — without imposing the catalog on strangers. The restriction they asked for ("only developers, not users") is expressed as a capability that is off by default in every bundle seed except `admin`, and is guest-ineligible.

## Decisions taken with the maintainer

| Question | Decision |
|---|---|
| Scope of definitions | Per calendar, managed by owner / `manageCustomFields` |
| Preset → shift | Preset value is a default, copied into the shift on creation (like `defaultSignupCapacity`); no live inheritance |
| Types | `text`, `number`, `date`, `checkbox`, `select` |
| Permission for setting values | None extra — whoever may edit the shift/preset may set its values |
| Value storage | Two parallel child tables, mirroring `shift_time_segments` / `preset_time_segments` |
| Surfaces | Shift form, preset form, day detail column, month/week cells, PDF, ICS |
| Month/week visibility | `showInCalendar` on the definition only; no per-user view setting |

### Why two child tables

Three options were weighed:

- **JSON column on `shifts` and `shift_presets`** — no join, fewest files touched, but deleting a definition orphans its values in every row, and cleaning up means rewriting every shift.
- **One EAV table for both entities** — `entityId` would point at two different tables, so it cannot carry a foreign key and cannot cascade; deleting a shift would leave its values behind for the application to clean up.
- **Two parallel child tables (chosen)** — `ON DELETE CASCADE` from both sides, and the read path already knows how to group child rows onto shifts because `lib/shift-time-ranges.ts` does exactly that for time segments. Cost: one more table and two near-identical query helpers.

## Data model

Three new tables in `lib/db/schema.ts`.

```ts
export const calendarCustomFields = sqliteTable("calendar_custom_fields", {
  id,                    // uuid
  calendarId,            // → calendars.id, cascade
  key,                   // stable slug, unique per calendar, immutable after creation
  label,                 // display name, freely renameable
  type,                  // "text" | "number" | "date" | "checkbox" | "select"
  options,               // json {id,label}[] — only for type "select", else null
  required,              // boolean, default false
  showInCalendar,        // boolean, default false — see "Surfaces"
  order,                 // integer, default 0
  createdBy,             // → user.id, set null
  createdAt, updatedAt,
});
// unique(calendarId, key), index(calendarId)

export const shiftCustomFieldValues = sqliteTable("shift_custom_field_values", {
  id,
  shiftId,               // → shifts.id, cascade
  fieldId,               // → calendarCustomFields.id, cascade
  value,                 // text, serialized per the definition's type
});
// unique(shiftId, fieldId), index(shiftId)

export const presetCustomFieldValues = sqliteTable("preset_custom_field_values", {
  id,
  presetId,              // → shiftPresets.id, cascade
  fieldId,               // → calendarCustomFields.id, cascade
  value,                 // text
});
// unique(presetId, fieldId), index(presetId)
```

`key` is deliberately separate from `label`. The API contract is `shift.customFields.<key>`; a label someone renames must not break a consumer. `key` is lowercase, `[a-z0-9_]`, unique per calendar, and cannot be changed once the field exists.

Values are a single `TEXT` column in every case, serialized per type:

| Type | Stored as |
|---|---|
| `text` | the string, trimmed |
| `number` | decimal string, `Number.isFinite` guaranteed on write |
| `date` | local `YYYY-MM-DD` via `formatDateToLocal()` — never through a UTC conversion |
| `checkbox` | `"true"` / `"false"` |
| `select` | the option's `id` |

Migration via `npm run db:generate` + `npm run db:migrate`; the generated SQL, snapshot and journal entry are committed together.

## Shared logic: `lib/custom-fields.ts`

Modelled on `lib/view-settings.ts` — one module that routes and client both import.

```ts
export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "checkbox", "select"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDefinition { /* the row shape, options typed */ }
export interface CustomFieldOption { id: string; label: string; }

export function serializeValue(type, input): string | null;
export function parseValue(type, raw): string | number | boolean | null;
export function validateFieldValue(definition, raw): { ok: true } | { ok: false; error: string };
export function sanitizeDefinition(input): CustomFieldDefinition | null;
export function normalizeKey(input): string | null;
```

Rules enforced server-side regardless of what the client sent:

- A `required` field rejects an empty value on write.
- A `number` that does not parse is rejected.
- A `select` value that is not one of the definition's option ids is rejected.
- `options` is accepted only for `type: "select"`, and must be a non-empty array of `{id, label}` with unique ids.
- An unknown key in an incoming `customFields` object is **dropped silently, not rejected** — a client holding a stale catalog must still be able to save a shift.

## Permissions

New capability `manageCustomFields` in `lib/permission-bundles.ts`:

- Added to `CAPABILITIES` and to the `administration` group in `CAPABILITY_GROUPS`.
- Guest-ineligible (added to `GUEST_INELIGIBLE`), like `manageCalendarSettings` — a share link must not let someone rebuild a foreign calendar's catalog.
- Present in the `admin` bundle seed only. `read`, `contribute` and `manage` seeds do not gain it, so existing bundles do not silently widen on upgrade.
- No `CAPABILITY_DEPENDENCIES` entry; it stands alone.

Setting values needs no capability of its own. The value belongs to the shift or preset, so `editOwnShift` / `editAnyShift` and `manageOwnPresets` / `manageAnyPresets` already gate it.

With `AUTH_ENABLED=false` every calendar resolves to `owner`, so the catalog is editable by anyone — consistent with the rest of the app, and handled by `resolveCalendarAccess()` without a special case.

New i18n keys for the capability's label and description in all six locales, added to `messages/de.json` first.

## API

### Catalog routes

Built like `app/api/calendars/[id]/bundles`:

| Route | Method | Capability |
|---|---|---|
| `/api/calendars/[id]/custom-fields` | GET | `viewShifts` |
| `/api/calendars/[id]/custom-fields` | POST | `manageCustomFields` |
| `/api/calendars/[id]/custom-fields/[fieldId]` | PATCH | `manageCustomFields` |
| `/api/calendars/[id]/custom-fields/[fieldId]` | DELETE | `manageCustomFields` |
| `/api/calendars/[id]/custom-fields/reorder` | PATCH | `manageCustomFields` |

`GET` requires only `viewShifts`: a read-only user still needs the catalog to label the values they can see.

`PATCH` on a field accepts `label`, `options`, `required`, `showInCalendar` — not `key` and not `type`.

Write routes call `rateLimit(request, userId, "customFields")`, with a new entry in the `config` object of `lib/rate-limiter.ts` and a matching env override documented in `.env.example`.

### Values on existing routes

Values get no endpoints of their own. They ride along on the routes that already exist:

- `GET /api/shifts` and `GET /api/presets` return `customFields: Record<key, value>` per row, parsed to the type's JS representation.
- `POST` / `PATCH` on `/api/shifts`, `/api/shifts/[id]`, `/api/presets`, `/api/presets/[id]` accept the same shape in the body.

`POST /api/shifts` with a `presetId` copies the preset's values into the new shift, at the same place `defaultSignupCapacity` is copied today. An explicit `customFields` object in the request wins over the preset's defaults.

A shift with `syncedFromExternal` rejects any `customFields` in a write, as it rejects other edits.

### `lib/shift-custom-fields.ts`

Copies the shape of `lib/shift-time-ranges.ts` exactly:

```ts
export function replaceShiftCustomFieldValues(tx, shiftId, values): void;
export function replacePresetCustomFieldValues(tx, presetId, values): void;
export async function withShiftCustomFields<T extends { id: string }>(rows, definitions): Promise<...>;
export async function withPresetCustomFields<T extends { id: string }>(rows, definitions): Promise<...>;
```

The `with*` helpers take the calendar's definitions so they can key the result by `key` and parse by `type`, and fetch all child rows with a single `inArray` query — no N+1. The `replace*` helpers are delete-then-insert inside the caller's existing transaction.

## Client data layer

`lib/query-keys.ts` gains:

```ts
customFields: {
  byCalendar: (calendarId: string) => ["custom-fields", calendarId] as const,
},
```

Values need no key of their own; they are part of the shift and preset payloads and are invalidated with them.

New `hooks/useCustomFields.ts` (read) and `hooks/useCustomFieldActions.ts` (mutations), following the `onMutate` → `onError` → `onSettled` shape of `hooks/useShifts.ts`. Every catalog mutation additionally invalidates `queryKeys.shifts.byCalendar` and `queryKeys.presets.byCalendar`, because deleting a definition cascades its values away.

Rate-limit responses are handled client-side with `isRateLimitError()` / `handleRateLimitError()`.

## Surfaces

One lever: **`showInCalendar` on the definition**, set by whoever manages the catalog — is this field compact enough to render in a cell at all? There is no per-user toggle; see "No view setting" below.

| Surface | Behaviour |
|---|---|
| `components/shift-form-fields.tsx` | All fields, ordered by `order`, below the notes field. One renderer per type from `components/ui/`: Input, Input `type="number"`, the existing date picker, Switch, Select. Read-only for `syncedFromExternal` shifts. |
| `components/preset-form.tsx` | Same fields, labelled as default values. |
| `components/day-detail.tsx` | Fields with `showInCalendar` and a non-empty value, rendered under the note (currently `day-detail.tsx:156`), in the same muted typography. |
| `components/mobile-day-sheet.tsx` | Same as day detail. |
| `components/month-grid.tsx`, `components/week-grid.tsx` | Fields with `showInCalendar` and a non-empty value. See the height constraint below. |
| **new** `components/custom-field-manage-sheet.tsx` | The catalog editor, composed from `components/ui/base-sheet.tsx`, registered in `components/dialog-manager.tsx` rather than rendered inline. Form logic lives in `hooks/useCustomFieldForm.ts`. |

Empty values are never rendered on any compact surface.

### Month/week height constraint

`components/month-grid.tsx:248` computes row height as `DESKTOP_ROW + (showShiftNotes && entry.shift.notes ? DESKTOP_SUB_LINE : 0)` — exactly one extra line. Several fields would break that arithmetic and overflow the cell.

Therefore the month and week cells render the visible fields **joined into a single line**, `Label: value · Label: value`, truncated at the end. The height calculation gains the same single `DESKTOP_SUB_LINE`, conditional on the shift having at least one visible non-empty value. The full list stays in the day detail column and the edit sheet.

### No view setting

An earlier draft added `showShiftCustomFields` to `CalendarViewSettings`, mirroring `showShiftNotes`, so a viewer could hide the extra line. It was dropped.

Notes exist in every calendar, so their toggle earns its place in the view settings sheet. Custom fields will exist in almost none — the checkbox would sit in every user's settings for a feature they have not enabled, which is how a settings panel becomes unusable. `showInCalendar` on the definition already keeps noisy fields out of the cells, and the person who defines a field is the person who knows whether it belongs there.

This is cheap to revisit: `sanitizeCalendarViewSettings` falls back per key, so a `showShiftCustomFields` added later reads absent stored settings as the default. No migration, no data format is foreclosed. If viewers of a shared calendar ask for the escape hatch, it is a small follow-up commit.

`lib/view-settings.ts`, `hooks/useViewSettings.ts`, `components/view-settings-sheet.tsx`, `app/page.tsx`, `components/calendar-workspace.tsx` and `components/compare-workspace.tsx` are therefore untouched by this feature.

## Exports

- **ICS** (`app/api/export/ics/route.ts:119`): visible, non-empty values are appended to `event.description` as `Label: value` lines, after the note.
- **PDF** (`app/api/export/pdf/route.ts:278`): same position and the same `splitTextToSize` wrapping as the notes block. No new column — the fixed-width column layout around line 246 stays untouched.

Both exports include every field with a value, not only `showInCalendar` ones; the constraint there is cell width, which does not apply to a document.

## Audit logging

New metadata interfaces in `lib/audit-log.ts`, added to the discriminated union rather than passed as loose objects:

```ts
export interface CustomFieldCreatedMetadata { calendarId, calendarName, fieldKey, fieldLabel, fieldType }
export interface CustomFieldUpdatedMetadata { calendarId, calendarName, fieldKey, changes }
export interface CustomFieldDeletedMetadata { calendarId, calendarName, fieldKey, fieldLabel, affectedShifts, affectedPresets }
```

Logged through `logUserAction` from the catalog routes. Setting values is not audited separately — it is part of the shift/preset edit that is already logged.

## Edge cases

| Case | Behaviour |
|---|---|
| Definition deleted | `ON DELETE CASCADE` removes every value. The confirm dialog names the number of affected shifts and presets first. |
| Type change requested | Not allowed. `text` → `number` would make stored values unreadable. The sheet offers delete-and-recreate instead. |
| `required` turned on later | Applies to new writes only; existing shifts are not retroactively invalid and are not blocked from other edits. |
| `key` collision | Rejected with 409 and a field-level error in the form. |
| Stale client catalog | Unknown keys in a write are dropped, not rejected. |
| Synced shift | Values are read-only; `createEventFingerprint` is unchanged, so a sync run neither reads nor overwrites them. |
| Calendar deleted | Cascades through `calendarId` on the definitions and through both child tables. |
| Guest with a share link | May read values, may set them if their bundle grants shift editing, may never edit the catalog. |

## Testing

There is no unit-test framework in this repo; the gate is `npm test` (lint + build + i18n). Beyond that, the manual pass before opening the PR:

1. `npm run db:generate` + `npm run db:migrate` apply cleanly on an existing database with shifts and presets.
2. One field of each of the five types created, reordered, renamed; `key` and `type` are not editable.
3. A preset value pre-fills a shift stamped from that preset; editing the preset afterwards leaves the shift alone.
4. `GET /api/shifts?calendarId=…` returns `customFields` keyed by `key` with parsed types.
5. Toggling `showInCalendar` changes the month and week cells; row height stays correct with several fields on one shift.
6. Deleting a definition removes its values from every shift and preset.
7. A share-link guest cannot reach the catalog routes (403) but sees the values.
8. PDF and ICS exports contain the values.
9. `AUTH_ENABLED=false` still allows catalog management.

## Delivery

One branch `feat/custom-fields`, Conventional Commits, split roughly as: schema + `lib/custom-fields.ts` + capability → API routes → client hooks + manage sheet → form integration → day detail and grids → exports. German i18n keys land with the commit that uses them; the other five locales follow in the same commit so `npm run i18n` stays green.
