# BetterShift AI Coding Instructions

## Project Overview

**BetterShift** is a modern shift management web application for variable work schedules. Users manage unlimited calendars with one-click shift toggles, external calendar sync (iCal/Google/Outlook), calendar sharing with granular permissions, reusable presets, and multi-language support. Built with **Next.js 16 (App Router)**, **React 19**, **SQLite + Drizzle ORM**, and **Better Auth**.

## Tech Stack Quick Reference

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5 (strict mode)
- **UI**: Tailwind CSS 4, shadcn/ui (Radix UI primitives), Lucide icons, Motion animations
- **Database**: SQLite (via better-sqlite3) + Drizzle ORM 0.44
- **Auth**: Better Auth 1.4 (enabled by default) - email/password + OAuth (Google/GitHub/Discord) + custom OIDC
- **i18n**: next-intl 4.5 - Supported locales: `en`, `de`, `it`
- **Key Libraries**: date-fns, ical.js, jsPDF, @dnd-kit, recharts, sonner (toasts)

## Architecture Patterns

### 1. Server Components First

- **Default**: All components under `app/` are Server Components unless marked with `"use client"`
- **Client boundaries**: Components in `/components` are `"use client"` by default (interactive UI)
- API routes are in `app/api/**` with `GET/POST/PUT/PATCH/DELETE` exports

### 2. Database Layer

**Location**: [`lib/db/schema.ts`](lib/db/schema.ts)

**Key tables**:

- `user`, `session`, `account`, `verification` (Better Auth tables)
- `calendars` - has `ownerId` (nullable), `guestPermission` (`none`/`read`/`write`)
- `calendarShares` - many-to-many with permissions (`owner`/`admin`/`write`/`read`)
- `shifts`, `presets`, `notes`, `externalSyncs`, `syncLogs`

**Migrations**: Use Drizzle Kit commands:

```bash
npm run db:generate  # Generate SQL from schema changes
npm run db:migrate   # Apply migrations to database
npm run db:studio    # Open Drizzle Studio GUI
```

### 3. Authentication & Permissions

**Feature flag**: Auth is **enabled by default** (`AUTH_ENABLED=true`) for better security. Can be disabled by setting `AUTH_ENABLED=false`.

**Configuration**: [`lib/auth.ts`](lib/auth.ts), [`lib/auth/env.ts`](lib/auth/env.ts), [`lib/public-config.ts`](lib/public-config.ts)

#### Hybrid Approach: When to Use Better Auth vs. Custom Code

**✅ Use Better Auth for:**

- **Authentication**: Login, logout, session management, token handling
- **OAuth**: Google, GitHub, Discord, custom OIDC integration
- **Admin Operations**: `auth.api.banUser()`, `auth.api.setUserPassword()`, `auth.api.removeUser()`
- **Access Control Config**: Role registration (`lib/auth/access-control.ts`) - only for Better Auth internal use

**✅ Use Custom Code for:**

- **Permission Checks**: All `canEditUser()`, `canDeleteUser()`, `canBanUser()` functions in `lib/auth/admin.ts`
- **Calendar Permissions**: `owner > admin > write > read` hierarchy in `lib/auth/permissions.ts`
- **Admin UI Logic**: User management, filtering, sorting (direct DB queries)
- **Audit Logging**: App-specific event tracking in `lib/audit-log.ts`

**Why**: Better Auth handles auth operations (with automatic session revocation, BCrypt hashing, etc.), while custom code provides synchronous, simple permission checks without async overhead. See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for full details.

#### Calendar Permission Hierarchy

**Permission hierarchy** (highest to lowest):

1. `owner` - Created the calendar, full control
2. `admin` - Can manage shares and settings
3. `write` - Can edit shifts/notes/presets
4. `read` - View only

**Critical functions** in [`lib/auth/permissions.ts`](lib/auth/permissions.ts):

- `getUserCalendarPermission(userId, calendarId)` - Returns permission level or `null`
- `checkPermission(userId, calendarId, required)` - Boolean check with hierarchy
- `getUserAccessibleCalendars(userId)` - Returns all calendars user can access
- `canViewCalendar(userId, calendarId)` - Shorthand for read permission check

**Guest access**: When auth is enabled, unauthenticated users (`userId = null`) can access calendars with `guestPermission != "none"`. Use `allowGuestAccess()` to check if feature is enabled.

#### Session Management

**Session utilities** in [`lib/auth/sessions.ts`](lib/auth/sessions.ts):

```typescript
import {
  getSessionUser,
  getUserSessions,
  revokeAllSessions,
} from "@/lib/auth/sessions";

// Get current user from request (API routes)
const user = await getSessionUser(request.headers);

// Session management (API routes only - for bulk operations)
const sessions = await getUserSessions(userId, currentSessionId);
await revokeAllSessions(userId, exceptCurrentId); // Bulk revoke all except current
```

**Client-side session management**: Use Better Auth's built-in client functions:

```typescript
import { authClient } from "@/lib/auth/client";

// List all active sessions for current user
const sessions = await authClient.listSessions();

// Revoke all other sessions (except current)
await authClient.revokeOtherSessions();
```

**Session management hook** in [`hooks/useSessions.ts`](hooks/useSessions.ts):

```typescript
const { sessions, isLoading, revokeAllSessions } = useSessions();

// Revoke all other sessions
await revokeAllSessions(); // Uses authClient.revokeOtherSessions() internally
```

**Note**: Individual session revocation is not supported to prevent users from accidentally revoking their own active session. Only "revoke all other sessions" is available.

**UI permission checks**: Use `useCalendarPermission(calendarId)` hook:

```typescript
const { canEdit, canDelete, canShare, permission } =
  useCalendarPermission(calendarId);
```

### 4. Public Configuration (Environment Variables)

**NO MORE `NEXT_PUBLIC_` prefixes!** Server-only variables are exposed to the client safely via SSR injection.

**Architecture**:

- **Server-side**: [`lib/public-config.ts`](lib/public-config.ts) - `getPublicConfig()` function defines what's exposed
- **Client-side**: [`hooks/usePublicConfig.ts`](hooks/usePublicConfig.ts) - `usePublicConfig()` hook for React components
- **SSR Injection**: Config injected as `window.__PUBLIC_CONFIG__` in root layout (zero latency)

**Usage patterns**:

```typescript
// Server Components (direct access)
import { getPublicConfig } from "@/lib/public-config";
const config = getPublicConfig();
if (config.auth.enabled) {
  /* ... */
}

// Client Components (use hook)
import { usePublicConfig } from "@/hooks/usePublicConfig";
const { auth, oauth, oidc } = usePublicConfig();
if (auth.enabled) {
  /* ... */
}

// Auth-specific helper hook
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
const { isAuthEnabled, allowRegistration, allowGuest, providers } =
  useAuthFeatures();
```

**Environment variables** (no duplicates needed):

```bash
# Auth config (automatically exposed to client)
AUTH_ENABLED=true
BETTER_AUTH_URL=http://localhost:3000
ALLOW_USER_REGISTRATION=true
ALLOW_GUEST_ACCESS=false
```

**Key functions**:

- `getPublicConfig()` - Server: Returns config object with all public values
- `usePublicConfig()` - Client: Hook to access config in React components
- `useAuthFeatures()` - Client: Convenience hook for auth-related flags
- Feature flags in [`lib/auth/feature-flags.ts`](lib/auth/feature-flags.ts) are SERVER-ONLY now

### 5. Real-Time Updates (SSE)

**Event stream**: [`app/api/events/stream/route.ts`](app/api/events/stream/route.ts) - Server-Sent Events endpoint

**Event emitter**: [`lib/event-emitter.ts`](lib/event-emitter.ts) - Singleton pattern with HMR support

**Emit events after mutations**:

```typescript
import { eventEmitter } from "@/lib/event-emitter";

// After creating/updating/deleting
eventEmitter.emit("calendar-change", {
  type: "shift" | "preset" | "note" | "calendar" | "sync-log",
  action: "create" | "update" | "delete" | "reorder",
  calendarId: string,
  data: unknown,
});
```

**Client connection**: Use `useSSEConnection` hook in [`hooks/useSSEConnection.ts`](hooks/useSSEConnection.ts) - automatically reconnects, handles visibility changes, and triggers data refreshes.

### 6. Component Architecture

**Sheet pattern** (side panel): All forms use [`components/ui/base-sheet.tsx`](components/ui/base-sheet.tsx):

- Unsaved changes confirmation via `useDirtyState` hook
- Consistent header/footer styling with gradient backgrounds
- Example: [`components/shift-sheet.tsx`](components/shift-sheet.tsx)

**Dialog pattern**: Use [`components/ui/dialog.tsx`](components/ui/dialog.tsx) from shadcn/ui

- List views, confirmations, and read-only displays
- Example: [`components/shifts-overview-dialog.tsx`](components/shifts-overview-dialog.tsx)

**Custom hooks pattern**:

- Data fetching: `useShifts`, `usePresets`, `useNotes`, `useCalendars` (in `/hooks`)
- Actions: `useShiftActions`, `useNoteActions` (handle CRUD + optimistic updates)
- Forms: `useShiftForm`, `usePresetManagement` (form state + validation)

### 7. Internationalization

**Config**: [`lib/i18n.ts`](lib/i18n.ts) - Detects locale from cookie (`NEXT_LOCALE`) or `Accept-Language` header

**Usage**:

```typescript
import { useTranslations } from "next-intl";

const t = useTranslations();
t("shift.title"); // Returns translated string
t("common.createError", { item: t("shift.title") }); // With interpolation
```

**Message files**: [`messages/en.json`](messages/en.json), `de.json`, `it.json` - Nested JSON structure

### 8. External Calendar Sync

**iCal parsing**: Uses `ical.js` library to parse `.ics` feeds

**Sync flow**:

1. User adds external sync URL + calendar mapping
2. Manual/auto sync triggers [`app/api/external-syncs/[id]/sync/route.ts`](app/api/external-syncs/[id]/sync/route.ts)
3. Shifts created with `syncedFromExternal: true`, `externalSyncId` set
4. Sync logs stored in `syncLogs` table for error tracking

**Read-only enforcement**: Synced shifts cannot be edited/deleted by users. Check `shift.syncedFromExternal` before allowing mutations.

## Development Workflow

### Environment Setup

**Required files**:

- `.env` - Copy from `.env.example` and configure
- `sqlite.db` - Auto-created on first run

**Critical env vars**:

- `DATABASE_URL` - Default: `file:./sqlite.db`
- `AUTH_ENABLED` - Enable/disable auth system (default: `true`)
- `BETTER_AUTH_SECRET` - Required if auth enabled (generate with `npx @better-auth/cli secret`)
- `BETTER_AUTH_URL` - Auth callback URL (e.g., `http://localhost:3000`)

**Note**: No `NEXT_PUBLIC_` prefixes needed - client values are automatically exposed via [`lib/public-config.ts`](lib/public-config.ts)

### Running the App

```bash
npm install              # Install dependencies
npm run dev             # Start dev server (localhost:3000)
npm run build           # Production build
npm run lint            # ESLint check
npm run test            # Run lint + build (CI check)
```

### Docker Deployment

```bash
docker-compose up -d --build    # Build and start container
```

Pre-built images: `ghcr.io/pantelx/bettershift:latest` (stable), `:dev` (bleeding edge)

### Database Changes

1. Modify [`lib/db/schema.ts`](lib/db/schema.ts)
2. Generate migration: `npm run db:generate`
3. Review SQL in `drizzle/` folder
4. Apply migration: `npm run db:migrate`

## Common Patterns

### API Route Structure

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/sessions";
import { checkPermission } from "@/lib/auth/permissions";
import { eventEmitter } from "@/lib/event-emitter";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.headers);
  const { calendarId, ...data } = await request.json();

  // Check permissions
  const canEdit = await checkPermission(user?.id, calendarId, "write");
  if (!canEdit) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  // Perform database operation
  const [result] = await db
    .insert(table)
    .values({ ...data, calendarId })
    .returning();

  // Emit SSE event
  eventEmitter.emit("calendar-change", {
    type: "shift",
    action: "create",
    calendarId,
    data: result,
  });

  return NextResponse.json(result, { status: 201 });
}
```

### Optimistic Updates

See [`hooks/useShifts.ts`](hooks/useShifts.ts) `createShift` function:

1. Generate temp ID: `temp-${Date.now()}`
2. Add optimistic item to state immediately
3. Make API call
4. On error: Remove temp item, show toast
5. On success: Replace temp item with real data from API

### Date Handling

**Always use local dates** (no timezone conversions):

- Store dates as `YYYY-MM-DD` strings in SQLite
- Use `formatDateToLocal(date)` from [`lib/date-utils.ts`](lib/date-utils.ts) before saving
- Display with `date-fns` + locale from `getDateLocale(locale)`

## Migration Context

**Status**: Auth system migration is **in progress**. See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for full details.

**Backward compatibility**: All features work without auth enabled. Auth can be disabled by setting `AUTH_ENABLED=false`. When auth is off, all users have `owner` permission to all calendars.

## Key Files Reference

- [`app/page.tsx`](app/page.tsx) - Main calendar view (1300+ lines, complex state management)
- [`lib/db/schema.ts`](lib/db/schema.ts) - Complete database schema (Better Auth + app tables)
- [`lib/auth/permissions.ts`](lib/auth/permissions.ts) - Permission checks and calendar access logic
- [`lib/auth/sessions.ts`](lib/auth/sessions.ts) - Session management & current user utilities (request context + Better Auth integration)
- [`hooks/useSessions.ts`](hooks/useSessions.ts) - Client-side session management hook (uses Better Auth client)
- [`lib/public-config.ts`](lib/public-config.ts) - Server-side public config definition (no NEXT*PUBLIC*\*)
- [`hooks/usePublicConfig.ts`](hooks/usePublicConfig.ts) - Client-side config access hook
- [`hooks/useAuthFeatures.ts`](hooks/useAuthFeatures.ts) - Auth-specific feature flags hook
- [`components/calendar-grid.tsx`](components/calendar-grid.tsx) - Core calendar rendering with shift display
- [`hooks/useSSEConnection.ts`](hooks/useSSEConnection.ts) - Real-time sync connection management
- [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) - Detailed auth migration plan with phases and todos

## Important Notes

- **No NEXT*PUBLIC***: Use `getPublicConfig()` on server, `usePublicConfig()` hook on client - never `process.env.NEXT_PUBLIC_*`
- **Better Auth first**: Always check [Better Auth docs](https://www.better-auth.com/docs) before implementing auth features - use built-in methods, don't reinvent
- **SSE is required**: All mutations must emit events to keep clients in sync
- **Permission checks everywhere**: Check permissions in both API routes (server) and UI (client) for security + UX
- **Strict TypeScript**: No `any` types, use Drizzle-inferred types from schema
- **Translations required**: All user-facing strings must use `t()` function
- **Guest mode**: When auth enabled, respect `guestPermission` on calendars for unauthenticated access
