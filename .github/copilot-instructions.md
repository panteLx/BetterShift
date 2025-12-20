# BetterShift Copilot Instructions

## Quick Reference

- **Framework**: Next.js 16 App Router + React 19
- **Database**: SQLite + Drizzle ORM (`./data/sqlite.db`)
- **UI**: Tailwind CSS 4 + shadcn/ui + BaseSheet component
- **i18n**: next-intl (de/en/it) - always use informal "du" in German
- **Critical**: Never use `db:push`, always generate migrations
- **State**: ALWAYS use existing hooks from `hooks/` - NEVER implement custom fetch logic

## Core Architecture

### Tech Stack

- **Framework**: Next.js 16 with App Router (`app/` directory)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components (`components/ui/`)
- **Database**: SQLite via Drizzle ORM (file: `./data/sqlite.db`)
- **i18n**: next-intl (German/English/Italian, cookie-based + browser detection)
- **State**: Client-side with React hooks, custom hooks in `hooks/`

### Database Schema

Core tables with cascade relationships:

- `calendars` → `shifts`, `shiftPresets`, `calendarNotes` (cascade delete)
- `shiftPresets` → `shifts` (set null on delete)
- IDs: `crypto.randomUUID()`, Timestamps: integers (auto-converted to Date)
- Passwords: SHA-256 hashed via `lib/password-utils.ts`

### Database Migrations

```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
```

**Critical**: Never use `db:push` - prefer explicit migrations. Schema changes require updating `lib/db/schema.ts` AND generating migrations.

### API Routes

Next.js 16 pattern - dynamic params are async:

```typescript
// Dynamic routes - ALWAYS await params
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

### Password Protection

Two-tier system via `passwordHash` and `isLocked`:

- **Write-Only** (`isLocked=false`): Password for mutations only
- **Full Lock** (`isLocked=true`): Password for all operations

**Key Implementation**:

```typescript
// GET - check isLocked flag
if (calendar.passwordHash && calendar.isLocked) {
  // Require password
}

// POST/PUT/DELETE - always check passwordHash
if (calendar.passwordHash) {
  // Require password
}
```

**Client-Side Flow**:

- Use `lib/password-cache.ts`: `getCachedPassword()`, `verifyAndCachePassword()`, `setCachedPassword()`, `removeCachedPassword()`
- All data hooks auto-include cached passwords in requests
- Locked calendars show integrated unlock form - no page reload needed
- Hooks return empty arrays on 401 (graceful degradation)

### State Management & Custom Hooks

**CRITICAL: ALWAYS use existing custom hooks instead of implementing custom logic.**

#### Available Custom Hooks

**Data Management** (CRUD operations):

- `useCalendars()` - Calendar CRUD with auto-password caching
- `useShifts()` - Shift CRUD with optimistic updates
- `usePresets()` - Preset fetching with silent refresh
- `usePresetManagement()` - Preset CRUD operations
- `useNotes()` - Note CRUD with password protection
- `useShiftStats()` - Aggregated shift statistics
- `useCompareCalendars()` - Multi-calendar data for compare mode

**Action Hooks** (Complex operations):

- `useShiftActions()` - Shift operations with password handling & optimistic UI
- `useNoteActions()` - Note dialog state & submission flow

**Password Management**:

- `usePasswordManagement()` - Central password state & verification
- `usePasswordProtection()` - Per-component password utilities

**UI/Form Hooks**:

- `useDirtyState()` - Unsaved changes tracking (ALWAYS use for forms/sheets)
- `useShiftForm()` - Shift form state & preset application
- `useDialogStates()` - Centralized dialog visibility state
- `useViewSettings()` - View preferences with localStorage

**External Sync & SSE**:

- `useExternalSync()` - iCal/webcal subscription management
- `useSSEConnection()` - Real-time updates via Server-Sent Events

#### Hook Usage Rules

**DO:**

- ✅ ALWAYS use existing hooks for CRUD (never custom `fetch()` logic)
- ✅ Use `getCachedPassword()` / `verifyAndCachePassword()` for password handling
- ✅ Use `useDirtyState` for all forms/sheets with input
- ✅ Pass `onPasswordRequired` callbacks to hooks that support it

**DON'T:**

- ❌ NEVER implement custom `fetch()` calls for shifts/presets/notes/calendars
- ❌ NEVER manually manage password state - use password hooks
- ❌ NEVER implement custom dirty state tracking

**See `app/page.tsx` for complete hook integration pattern.**

### Internationalization

next-intl setup: `messages/{de,en,it}.json` - cookie-based with browser detection fallback

**Usage**:

```typescript
const t = useTranslations();
t("shift.create"); // Feature-specific keys
t("common.created", { item: t("shift.shift_one") }); // Parametrized
```

**Key Structure** (centralized to avoid duplicates):

- `common.*` - CRUD operations with `{item}` parameter (`created`, `updated`, `deleted`, `createError`, `updateError`, `deleteError`)
- `validation.*` - All validation messages (`passwordMatch`, `passwordIncorrect`, `urlInvalid`, etc.)
- `form.*` - Reusable form labels (`nameLabel`, `colorLabel`, `passwordLabel`, `notesLabel`, `urlLabel`)
- Feature namespaces - Specific keys (`shift.startTime`, `calendar.select`, etc.)

**Rules**:

- ALWAYS add new keys to all three language files (de.json, en.json, it.json)
- German: ALWAYS use informal "du" form (never "Sie")
- Check `common.*`, `validation.*`, `form.*` before creating new keys

### Component Design Patterns

#### Sheets

**Use `BaseSheet` for simple forms** (create, edit, settings):

```typescript
<BaseSheet
  open={open}
  onOpenChange={onOpenChange}
  title={t("sheet.title")}
  showSaveButton
  onSave={handleSave}
  isSaving={isSaving}
  saveDisabled={!isValid || !isDirty}
  hasUnsavedChanges={isDirty}
  maxWidth="md" // sm|md|lg|xl
>
  {/* Form content */}
</BaseSheet>
```

**Custom sheets only for**: Multi-step wizards, complex layouts, custom footer actions

**Styling**: Gradient headers (`from-primary/10 via-primary/5`), border opacity (`border-border/50`), consistent padding (`px-6 py-6`), sticky footer

**ALWAYS use `useDirtyState` hook** for unsaved changes tracking - see `preset-manage-sheet.tsx` for reference.

#### Other Patterns

- **Dialogs**: Read-only info or confirmations only (no forms)
- **Confirmation**: Use `ConfirmationDialog` component (NEVER native `confirm()`)
- **Colors**: `PRESET_COLORS` array, hex format, 20% opacity for backgrounds
- **Dates**: `formatDateToLocal()` for YYYY-MM-DD

### UI/UX Design Principles

#### Live Updates via SSE

All components must support real-time updates via Server-Sent Events:

- Listen to relevant SSE events (shift, preset, note, sync-log updates)
- Use silent refresh patterns: `fetchData(false)` to update without loading states
- Implement refresh triggers: counter-based props (e.g., `syncLogRefreshTrigger`)
- Avoid flashing/blinking during updates - update data smoothly without UI disruption

#### Sheet Design Standards

- **Simple Sheets**: Use `BaseSheet` component (handles styling, dirty state, buttons)
- **Complex Sheets**: Follow custom pattern (see Component Design Patterns section)
- **Key Requirements**:
  - Gradient backgrounds for visual depth
  - Consistent padding (`px-6`, `py-6`, `py-4`)
  - Border styling with reduced opacity (`border-border/50`)
  - Sticky footer with always-visible Save button
  - Full-height layout: `flex flex-col` with `flex-1 overflow-y-auto`
  - Gradient text for titles (`bg-gradient-to-r from-foreground to-foreground/70`)

### Calendar Interactions

- **Left-click**: Toggle shift with selected preset
- **Right-click**: Open note dialog (prevent default context menu)
- **Toggle logic**: Delete if exists, create if not
- **Indicators**: `<StickyNote>` icon for days with notes

## Docker & Production

### Local Development

```bash
npm install
npm run db:migrate  # One-time setup
npm run dev         # http://localhost:3000
```

### Docker Deployment

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker-compose up -d --build
docker compose exec bettershift npm run db:migrate
```

**Note**: Dockerfile uses `next/standalone` output. `drizzle.config.ts` must be in runner stage for migrations.

## Common Gotchas

1. **Next.js 16**: Dynamic route params are async - always `await params`
2. **SQLite Timestamps**: Use `{ mode: "timestamp" }`, stored as integers, auto-converted to Date
3. **Cascade Deletes**: Deleting calendar removes all shifts/presets/notes
4. **Sheets vs Dialogs**: Use BaseSheet for simple forms, custom sheets for complex layouts, Dialogs only for read-only info
5. **Color Format**: Store hex (`#3b82f6`), use 20% opacity for backgrounds (`${color}20`)
6. **Mobile UI**: Separate calendar selector with `showMobileCalendarDialog`

## Adding New Features

### New Database Table

1. Add table definition to `lib/db/schema.ts` with relationships
2. Export types: `export type TableName = typeof tableName.$inferSelect;`
3. Run `npm run db:generate && npm run db:migrate`
4. Create API routes: `app/api/tablename/route.ts` and `app/api/tablename/[id]/route.ts`
5. Add translations to all language files (`messages/{de,en,it}.json`)
6. Create custom hook in `hooks/` for CRUD operations (follow existing patterns)

## Development Workflow

**Local Setup**:

```bash
npm install
npm run db:migrate  # One-time setup
npm run dev         # http://localhost:3000
```

**Docker**:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
docker-compose up -d --build
docker compose exec bettershift npm run db:migrate
```

**Debugging**:

- Database GUI: `npm run db:studio`
- Build check: `npm run build`
- All API errors logged via `console.error()`

## Code Style

- **Language**: English for all code, comments, variable names
- **Comments**: Only for complex/non-obvious logic
- **Code clarity**: Self-documenting names over comments
