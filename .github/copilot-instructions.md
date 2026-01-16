# BetterShift - Copilot Instructions

## Architecture Overview

BetterShift is a **Next.js 16** self-hosted shift management app using:

- **Database**: SQLite with Drizzle ORM (`lib/db/schema.ts`)
- **Auth**: better-auth with multi-provider support (`lib/auth.ts`, `lib/auth/`)
- **State**: TanStack Query for server state (`hooks/use*.ts`)
- **UI**: Radix primitives + shadcn/ui (`components/ui/`)
- **i18n**: next-intl with `de.json` as source of truth (`messages/`)

### Key Data Flow

```
API Route → getSessionUser() → getUserCalendarPermission() → db query → Response
Component → useQuery hook → fetch('/api/...') → TanStack Query cache
```

## Critical Patterns

### Permission System (`lib/auth/permissions.ts`)

Every calendar operation must check permissions. Priority order:

1. Owner (`calendar.ownerId === userId`)
2. Share permission (`calendarShares` table)
3. Access token (cookie-based)
4. Guest permission (`calendar.guestPermission`)

```typescript
// Always use these helpers in API routes
import { getSessionUser } from "@/lib/auth/sessions";
import {
  canEditCalendar,
  getUserCalendarPermission,
} from "@/lib/auth/permissions";

const user = await getSessionUser(request.headers);
if (!(await canEditCalendar(user?.id, calendarId))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Query Keys (`lib/query-keys.ts`)

All queries must use centralized query keys for proper cache invalidation:

```typescript
import { queryKeys } from "@/lib/query-keys";

// Use factory functions
useQuery({ queryKey: queryKeys.calendars.all, ... });
useQuery({ queryKey: queryKeys.shifts.byCalendar(calendarId), ... });
```

### API Route Pattern

```typescript
// app/api/[resource]/route.ts
export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  // Check auth if enabled: isAuthEnabled() from lib/auth/feature-flags
  // Check permissions with getUserCalendarPermission() or similar
  // Rate limit sensitive operations: await rateLimit('type', identifier)
  // Audit log actions: await logUserAction('ACTION', userId, metadata, request)
}
```

### Component Structure

- Mark client components with `"use client"` at top
- Use `@/components/ui/` primitives (shadcn pattern)
- Sheets/dialogs use `BaseSheet` for consistent behavior
- Forms extract logic to custom hooks (`useShiftForm`, etc.)

## Development Commands

```bash
npm run dev          # Start dev server
npm run db:migrate   # Apply migrations
npm run i18n         # Validate translations (de.json is source)
npm run lint         # ESLint check
tsc --noEmit         # TypeScript check without emitting
npm run test         # Full validation: lint + build + i18n
```

## Common Tasks

### Adding a Translation

1. Add key to `messages/de.json` (primary source)
2. Run `npm run i18n` - it reports missing keys in en.json/it.json
3. Add translations to other locales

### Creating an API Endpoint

1. Create route in `app/api/[resource]/route.ts`
2. Use `getSessionUser()` for auth, `rateLimit()` for protection
3. Log actions with `logUserAction()` or `logSystemEvent()`
4. Return proper HTTP status codes with NextResponse.json()

### Adding Database Fields

1. Modify `lib/db/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:migrate` to apply

### Creating a Hook

Follow existing patterns in `hooks/`:

- Prefix with `use`
- Use `queryKeys` for query keys
- Handle rate limit errors with `isRateLimitError()` / `handleRateLimitError()`
- Show feedback with `toast` from sonner

## File Conventions

| Path                  | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `lib/auth/*.ts`       | Auth utilities (sessions, permissions, tokens) |
| `lib/db/schema.ts`    | All Drizzle table definitions                  |
| `hooks/use*.ts`       | TanStack Query hooks with mutations            |
| `components/ui/*.tsx` | Radix-based primitives (don't modify directly) |
| `app/api/`            | Route handlers (GET/POST/PATCH/DELETE)         |
| `messages/*.json`     | i18n strings (de.json is authoritative)        |

## Auth Modes

- `AUTH_ENABLED=true`: Full multi-user with roles (user/admin/superadmin)
- `AUTH_ENABLED=false`: Single-user mode, all operations bypass auth checks
- Check with `isAuthEnabled()` from `lib/auth/feature-flags`

## Important Rules

### Date Handling

Always use **local dates** without timezone conversion:

- Store as `YYYY-MM-DD` strings in SQLite
- Use `formatDateToLocal(date)` from `lib/date-utils.ts` before saving
- Display with `date-fns` + locale from `getDateLocale(locale)`

### External Sync (Read-Only)

Shifts synced from external calendars cannot be edited/deleted:

- Check `shift.syncedFromExternal` before allowing mutations
- These shifts have `externalSyncId` set

### Optimistic Updates

All mutations use TanStack Query optimistic updates (`hooks/useShifts.ts` as reference):

1. `onMutate`: Cancel queries, save previous state, apply optimistic update
2. `onError`: Rollback to previous state, show error toast
3. `onSettled`: Invalidate queries to refetch real data
