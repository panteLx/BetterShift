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

Calendars can be password-protected. Implementation flow:

1. Check localStorage via `getCachedPassword(calendarId)` from `lib/password-cache.ts`
2. Verify via `verifyAndCachePassword(calendarId, password)` - automatically caches valid passwords
3. On invalid password: Show `PasswordDialog`, which automatically caches on success
4. Use `pendingAction` state to retry operation after authentication

**Important**: Always use the utilities from `lib/password-cache.ts` instead of direct localStorage access:

- `getCachedPassword(calendarId)` - Get cached password
- `setCachedPassword(calendarId, password)` - Cache password after verification
- `removeCachedPassword(calendarId)` - Remove cached password
- `verifyAndCachePassword(calendarId, password)` - Verify and auto-cache if valid
- `hasValidCachedPassword(calendarId)` - Check if cached password is still valid

```typescript
// Example: Password check before action
const password = getCachedPassword(calendarId);
const result = await verifyAndCachePassword(calendarId, password);

if (result.protected && !result.valid) {
  setPendingAction({ type: "edit", shiftId: id, formData });
  setShowPasswordDialog(true);
  return;
}
```

### State Management

Main page (`app/page.tsx`) patterns:

- `useState` for shifts, presets, notes, calendars
- `useEffect` for data fetching on calendar/date changes
- `useRouter().replace()` for URL state sync
- `statsRefreshTrigger` counter for mutation tracking

### Internationalization

next-intl setup with auto-detection:

- Cookie `NEXT_LOCALE` overrides browser preference (`lib/i18n.ts`)
- Translations: `messages/{de,en}.json`
- Usage: `const t = useTranslations()` → `t("shift.create")`
- Date formatting: `locale === "de" ? de : enUS`

### Component Design Patterns

- **Dialogs**: Control state via props, reset on close
- **Forms**: Prevent default, validate, callback to parent
- **Colors**: Use `PRESET_COLORS` array, hex format (`#3b82f6`), 20% opacity for backgrounds
- **Dates**: `formatDateToLocal()` for YYYY-MM-DD format

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
