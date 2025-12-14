# BetterShift AI Coding Assistant Instructions

## Architecture Overview

**BetterShift** is a Next.js 16 App Router shift management application with SQLite database for managing work schedules across multiple calendars.

### Tech Stack

- **Framework**: Next.js 16 with App Router (`app/` directory)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components (`components/ui/`)
- **Database**: SQLite via Drizzle ORM (file: `./data/sqlite.db`)
- **i18n**: next-intl (German/English, cookie-based + browser detection)
- **State**: Client-side with React hooks, custom hooks in `hooks/`

### Database Schema (`lib/db/schema.ts`)

Core tables with cascade relationships:

- `calendars` → `shifts`, `shiftPresets`, `calendarNotes` (cascade delete)
- `shiftPresets` → `shifts` (set null on delete)
- IDs: `crypto.randomUUID()`
- Timestamps: Stored as integers, auto-converted to Date objects
- Passwords: SHA-256 hashed (via `lib/password-utils.ts`)

## Development Guidelines

### Database Migrations

After schema changes in `lib/db/schema.ts`:

```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
```

**Critical**:

- Migrations are version-controlled
- Never use `db:push` - prefer explicit migrations
- Schema changes require updating `lib/db/schema.ts` AND generating migrations

### API Routes

Follow these patterns (see `app/api/shifts/route.ts`):

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId");

  if (!calendarId) {
    return NextResponse.json({ error: "Missing calendarId" }, { status: 400 });
  }
}

// Dynamic routes - params are async in Next.js 16
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

### Password Protection

Calendars support two-tier password protection via `passwordHash` and `isLocked` fields:

**Two-Tier Protection System**:

- **Write-Only Protection** (`passwordHash` set, `isLocked=false`): Password required for mutations (POST/PUT/PATCH/DELETE), but read access (GET) is allowed without password
- **Full Protection** (`passwordHash` set, `isLocked=true`): Password required for all operations including read access

**API Route Implementation**:

```typescript
// GET endpoints - check both passwordHash AND isLocked
if (calendar.passwordHash && calendar.isLocked) {
  const { searchParams } = new URL(request.url);
  const password = searchParams.get("password");

  if (!password || !verifyPassword(password, calendar.passwordHash)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
}

// POST/PUT/PATCH/DELETE endpoints - check only passwordHash
if (calendar.passwordHash) {
  const { password } = await request.json();

  if (!password || !verifyPassword(password, calendar.passwordHash)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
}
```

**Client-Side Password Flow**:

1. **Password Caching**: Use utilities from `lib/password-cache.ts`:

   - `getCachedPassword(calendarId)` - Retrieve password from localStorage
   - `verifyAndCachePassword(calendarId, password)` - Verify with server and cache if valid
   - `setCachedPassword(calendarId, password)` - Manually cache password
   - `removeCachedPassword(calendarId)` - Clear cached password

2. **Hooks Auto-Include Password**: All data-fetching hooks (`useShifts`, `usePresets`, `useNotes`) automatically:

   - Call `getCachedPassword(calendarId)` before each fetch
   - Append password as query parameter if present
   - Return empty arrays on 401 responses (graceful degradation)

3. **Locked Calendar UX**:

   - When `isLocked=true` and no valid cached password: Show integrated password form in main UI
   - After successful password entry: Call `handlePasswordSuccess(password)` which triggers:
     - `refetchShifts()`, `refetchPresets()`, `refetchNotes()`
     - `fetchExternalSyncs()`, `fetchSyncErrorStatus()`
     - `setStatsRefreshTrigger((prev) => prev + 1)`
   - All data loads immediately after unlock - no page reload needed

4. **Mutation Password Protection**:
   - Check cached password before mutation: `const result = await verifyAndCachePassword(calendarId, password)`
   - If `result.protected && !result.valid`: Set `pendingAction` and show `PasswordDialog`
   - On successful password entry: Execute pending action automatically

**Important Implementation Notes**:

- Never require password input twice - the integrated "Currently Locked" form is sufficient
- All hooks handle 401 gracefully by returning empty arrays (prevents UI crashes)
- Calendar list (GET `/api/calendars`) never requires password (allows calendar switching)
- Password verification is asynchronous - always await `verifyAndCachePassword`
- Cached passwords persist across sessions via localStorage

### State Management

Main page (`app/page.tsx`) patterns:

- `useState` for shifts, presets, notes, calendars
- `useEffect` for data fetching on calendar/date changes
- `useRouter().replace()` for URL state sync
- `statsRefreshTrigger` counter for mutation tracking

### Internationalization

next-intl setup with auto-detection:

- Cookie `NEXT_LOCALE` overrides browser preference (`lib/i18n.ts`)
- Translations: `messages/{de,en,it}.json` (German, English, Italian)
- Usage: `const t = useTranslations()` → `t("shift.create")`
- Date formatting: `locale === "de" ? de : (locale === "it" ? it : enUS)`
- **Important**: When adding new translation keys, ALWAYS add them to all three files (de.json, en.json, it.json)

**Translation Structure (Optimized)**:

The translation files use a centralized structure to eliminate duplicates and ensure consistency.

**German Translation Style**:

- Always use informal "du" form (never formal "Sie" form)
- Examples: "Möchtest du..." (not "Möchten Sie..."), "Bitte entsperre..." (not "Bitte entsperren Sie...")
- This applies to all user-facing messages, descriptions, hints, and instructions

**Common Keys (Parametrized)**:

```typescript
// Success/Error Messages - use {item} parameter
toast.success(t("common.created", { item: t("common.shifts") }));
toast.error(t("common.createError", { item: t("calendar.title") }));
toast.success(t("common.updated", { item: t("preset.preset") }));
toast.error(t("common.deleteError", { item: t("note.note") }));

// Available: common.created, common.updated, common.deleted
//           common.createError, common.updateError, common.deleteError
//           common.deleteConfirm, common.deleteConfirmWithWarning
```

**Validation Keys (Centralized)**:

```typescript
// Password validation
setError(t("validation.passwordMatch"));
setError(t("validation.passwordIncorrect"));
setError(t("validation.passwordRequired"));

// File/URL validation
toast.error(t("validation.fileRequired"));
toast.error(t("validation.fileTooLarge", { maxSize: "5MB" }));
toast.error(t("validation.urlRequired"));
toast.error(t("validation.urlInvalid"));
toast.error(t("validation.urlAlreadyExists"));
```

**Form Field Keys (Reusable)**:

```typescript
// Form labels and placeholders
<Label>{t("form.nameLabel")}</Label>
<Input placeholder={t("form.namePlaceholder", { example: t("calendar.name") })} />
<Label>{t("form.colorLabel")}</Label>
<Label>{t("form.passwordLabel")}</Label>
<Input placeholder={t("form.passwordPlaceholder")} />
<Label>{t("form.notesLabel")}</Label>
<Textarea placeholder={t("form.notesPlaceholder")} />
<Label>{t("form.urlLabel")}</Label>
<Input placeholder={t("form.urlPlaceholder")} />
```

**Key Rules**:

- **Never duplicate** CRUD success/error messages - always use `common.*` with `{item}` parameter
- **Never duplicate** validation messages - use `validation.*` namespace
- **Never duplicate** form field labels - use `form.*` namespace
- Feature-specific keys (e.g., `shift.startTime`, `calendar.select`) remain in their namespace
- When adding new features, check if message fits `common.*`, `validation.*`, or `form.*` before creating new keys

**Translation Key Usage Status**:

All translation keys in `messages/{de,en}.json` are actively used.

When adding new features, ensure all translation keys are actually used in components. Remove unused keys to keep translation files clean.

### Component Design Patterns

- **Dialogs**: Control state via props, reset on close
- **Forms**: Prevent default, validate, callback to parent
- **Colors**: Use `PRESET_COLORS` array, hex format (`#3b82f6`), 20% opacity for backgrounds
- **Dates**: `formatDateToLocal()` for YYYY-MM-DD format

### UI/UX Design Principles

**Live Updates**: All components must support real-time updates via Server-Sent Events (SSE):

- Listen to relevant SSE events (shift, preset, note, sync-log updates)
- Use silent refresh patterns: `fetchData(false)` to update without loading states
- Implement refresh triggers: counter-based props (e.g., `syncLogRefreshTrigger`)
- Avoid flashing/blinking during updates - update data smoothly without UI disruption

**Consistent Dialog Design**: All dialogs must follow the unified design pattern:

```tsx
<DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
  <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
    <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
      {t("dialog.title")}
    </DialogTitle>
    <DialogDescription className="text-sm text-muted-foreground">
      {t("dialog.description")}
    </DialogDescription>
  </DialogHeader>
  <div className="space-y-4 overflow-y-auto flex-1 px-6 pb-6">
    {/* Dialog content */}
  </div>
</DialogContent>
```

Key design elements:

- Gradient backgrounds for visual depth
- Consistent padding (`p-6`, `px-6`, `pb-6`)
- Border styling with reduced opacity (`border-border/50`)
- Backdrop blur effects for modern aesthetics
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
4. **Preset Auto-Save**: Shift dialog has `saveAsPreset` enabled by default
5. **Color Format**: Store hex (`#3b82f6`), use 20% opacity for backgrounds (`${color}20`)
6. **Mobile UI**: Separate calendar selector with `showMobileCalendarDialog`

## Adding New Features

### New Database Table

1. Add table definition to `lib/db/schema.ts` with relationships
2. Export types: `export type TableName = typeof tableName.$inferSelect;`
3. Run `npm run db:generate && npm run db:migrate`
4. Create API routes: `app/api/tablename/route.ts` and `app/api/tablename/[id]/route.ts`
5. Add translations to `messages/de.json` and `messages/en.json`

### New Component with Dialog

1. Create in `components/` using shadcn/ui Dialog
2. Props: `open`, `onOpenChange`, `onSubmit`, optional `onDelete`
3. Use `useTranslations()` for all text
4. Reset local state when `open` changes to false
5. Import and integrate in `app/page.tsx`

## Testing & Debugging

- Database GUI: `npm run db:studio` (opens Drizzle Studio)
- Build validation: `npm run build` (checks TypeScript errors)
- Production test: Use Docker locally before deploying
- Check console errors for API failures - all errors logged with `console.error()`

## Code Style Guidelines

- **Language**: All code, comments, variable names, and messages in English
- **Comments**: Only add comments for complex logic or non-obvious behavior
- **Migrations**: Never use `db:push` - prefer safe migrations (db:generate + manual review)
- **Code clarity**: Write self-documenting code with clear variable/function names
