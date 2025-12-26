# GitHub Copilot Instructions for BetterShift

This document provides comprehensive context and guidelines for GitHub Copilot when working with the BetterShift codebase.

## Project Overview

**BetterShift** is a modern shift management application designed to simplify variable work schedules. It allows users to manage unlimited calendars with one-click shift toggles, reusable presets, external calendar integration (Google, Outlook, iCal), calendar sharing & permissions, ICS/PDF export, and multi-language support.

### Key Features

- 📅 Multiple calendar management with color coding
- 🔄 External calendar sync (iCloud, Google, custom iCal)
- 🎨 Shift presets with custom labels, times, and colors
- 📝 Notes and events with recurring patterns
- 🔐 Multi-user authentication system (Better Auth)
- 👥 Calendar sharing with granular permissions (owner, admin, write, read)
- 🔗 Share calendars via access tokens (secure links)
- 📊 Live shift statistics and analytics
- 🌐 Multi-language support (English, German, Italian)
- 📤 Export to ICS and PDF formats

## Tech Stack

### Core Technologies

- **Next.js 16** - React framework with App Router (`app/` directory)
- **TypeScript 5** - Strict type checking enabled
- **React 19** - UI library with Server Components first approach
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Component library built on Radix UI primitives

### Database & ORM

- **SQLite** - Lightweight database (via `better-sqlite3`)
- **Drizzle ORM 0.44** - Type-safe SQL ORM
  - Configuration: [`drizzle.config.ts`](drizzle.config.ts)
  - Schema: [`lib/db/schema.ts`](lib/db/schema.ts)
  - Migrations: [`drizzle/`](drizzle/) directory (13 migrations)
  - CLI tools: `db:generate`, `db:migrate`, `db:studio`, `db:push`

### Authentication

- **Better Auth 1.4** - Modern authentication library
  - Email/Password authentication
  - OAuth providers: Google, GitHub, Discord
  - Custom OIDC support via `genericOAuth` plugin
  - Optional feature (disabled by default for backwards compatibility)
  - Configuration: [`lib/auth.ts`](lib/auth.ts), [`lib/auth/`](lib/auth/)
  - **Migration Status**: 🔄 In Progress
  - Calendar sharing & permissions system
  - Access tokens for secure link sharing (planned)
  - **Important**: Always check [Better Auth docs](https://www.better-auth.com/docs) before implementing auth features

### Internationalization

- **next-intl 4.5** - Type-safe i18n for Next.js
- Supported languages: English (en), German (de), Italian (it)
- Translation files: [`messages/`](messages/) directory

### UI & Styling

- **Radix UI** - Accessible component primitives (dialogs, dropdowns, etc.)
- **Lucide React** - Icon library
- **Motion** - Animation library (12.23)
- **Recharts** - Charts and data visualization
- **Sonner** - Toast notifications
- **React Colorful** - Color picker
- **React Day Picker** - Date picker component

### Development Tools

- **ESLint 9** - Code linting with flat config ([`eslint.config.mjs`](eslint.config.mjs))
- **Docker & Docker Compose** - Containerized development environment
- **OpenTelemetry** - Instrumentation setup ([`instrumentation.ts`](instrumentation.ts))
- **Dotenv** - Environment variable management

### Additional Libraries

- **date-fns 4.1** - Date manipulation and formatting
- **ical.js** - iCalendar parsing for external sync
- **jsPDF 3.0** - PDF generation for exports
- **@dnd-kit** - Drag and drop functionality (for preset reordering)
- **class-variance-authority** - CVA for component variants
- **clsx + tailwind-merge** - Conditional className utility (`cn()`)

## Project Structure

```
/app                      # Next.js App Router
  /api                   # API Routes (REST endpoints)
    /auth               # Authentication endpoints (Better Auth)
    /calendars          # Calendar CRUD operations
    /shifts             # Shift management and statistics
    /presets            # Preset management and reordering
    /notes              # Notes CRUD operations
    /external-syncs     # External calendar sync management
    /sync-logs          # Sync log retrieval
    /events             # SSE event streaming
    /releases           # Release/changelog data
    /version            # App version endpoint
  /login               # Login page
  /register            # Registration page
  /profile             # User profile page
  layout.tsx           # Root layout with providers
  page.tsx             # Home page (main calendar view)
  globals.css          # Global styles and Tailwind imports

/components              # React components
  /ui                   # shadcn/ui base components (Button, Card, Dialog, etc.)
  /skeletons            # Loading skeleton components
  app-header.tsx        # Main application header
  app-footer.tsx        # Application footer
  auth-header.tsx       # Authentication-related header
  auth-provider.tsx     # Auth session provider wrapper
  calendar-*.tsx        # Calendar-related components
  shift-*.tsx           # Shift-related components
  preset-*.tsx          # Preset management components
  note-*.tsx            # Note-related components
  external-sync-*.tsx   # External sync components
  *-dialog.tsx          # Dialog/modal components
  *-sheet.tsx           # Sheet/drawer components
  theme-*.tsx           # Theme-related components
  language-switcher.tsx # Language selector
  dialog-manager.tsx    # Global dialog state manager

/hooks                   # Custom React hooks
  useAuth.ts            # Authentication state
  useCalendars.ts       # Calendar data management
  useShifts.ts          # Shift data management
  usePresets.ts         # Preset data management
  useNotes.ts           # Notes data management
  useExternalSync.ts    # External sync operations
  useConnectedAccounts.ts # OAuth account management
  useShiftForm.ts       # Shift form state
  usePresetManagement.ts # Preset CRUD operations
  useDialogStates.ts    # Dialog visibility state
  useDirtyState.ts      # Form dirty state tracking

/lib                     # Utility functions and configurations
  /db                   # Database setup
    schema.ts           # Drizzle schema definitions
    index.ts            # Database client
  /auth                 # Authentication utilities
    index.ts            # Better Auth configuration
    client.ts           # Client-side auth hooks
    session.ts          # Server-side session helpers
    permissions.ts      # Permission checking
    feature-flags.ts    # Auth feature flags
    env.ts              # Environment variables
  types.ts              # TypeScript type definitions
  utils.ts              # General utilities (cn() helper)
  date-utils.ts         # Date formatting and manipulation
  event-utils.ts        # Event and note utilities
  export-utils.ts       # ICS/PDF export logic
  password-utils.ts     # ⚠️ DEPRECATED - Will be removed (legacy calendar passwords)
  password-cache.ts     # ⚠️ DEPRECATED - Will be removed (legacy password caching)
  auto-sync-service.ts  # Background sync scheduling
  ical-parser.ts        # iCalendar parsing
  proxy.ts              # Proxy configuration

/data                    # Static data and configurations
/demo                    # Demo/seed data scripts
/drizzle                 # Database migrations
/messages                # i18n translation files
/public                  # Static assets
```

## Architecture Decisions

### Server-First Architecture

- **Default to Server Components** - Use Client Components (`'use client'`) only when necessary
- **Data fetching in Server Components** - Avoid `useEffect` for data fetching
- **Server Actions** for mutations - Use `'use server'` directive
- **API Routes for client-side fetching** - Used by Client Components with `fetch()`

### Authentication Architecture

- **Optional authentication** - Disabled by default (`NEXT_PUBLIC_AUTH_ENABLED=false`)
- **Better Auth** integration with Drizzle adapter
- **Feature flags** control auth UI visibility ([`lib/auth/feature-flags.ts`](lib/auth/feature-flags.ts))
- **Permission system** for calendar sharing and access control
  - Permission levels: `owner` > `admin` > `write` > `read`
  - Defined in [`lib/auth/permissions.ts`](lib/auth/permissions.ts)
  - Calendar shares stored in `calendarShares` table
- **Calendar access tokens** for secure link sharing (🚧 planned)
- **Session-based** with configurable expiration
- **Migration in progress** - See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for details

### Database Architecture

- **SQLite for simplicity** - File-based database (`./data/sqlite.db`)
- **Drizzle ORM** for type-safe queries
- **Schema-first approach** - Single source of truth in [`lib/db/schema.ts`](lib/db/schema.ts)
- **Migrations** tracked in [`drizzle/`](drizzle/) with sequential numbering
- **Indexes** on foreign keys and frequently queried columns

### State Management

- **No global state library** - Leverage Server Components and React state
- **Custom hooks** encapsulate data fetching and mutations
- **Local state** with `useState` and `useReducer`
- **URL state** for navigation and filters
- **Sonner** for toast notifications

### API Structure

- **RESTful design** - CRUD operations follow REST conventions
- **Route handlers** in [`app/api/`](app/api/) directory
- **Endpoints:**
  - `/api/calendars` - Calendar CRUD
  - `/api/shifts` - Shift CRUD and statistics
  - `/api/presets` - Preset CRUD and reordering
  - `/api/notes` - Note CRUD
  - `/api/external-syncs` - External sync CRUD and manual sync
  - `/api/sync-logs` - Fetch sync logs
  - `/api/auth/*` - Authentication (Better Auth)
  - `/api/events/stream` - SSE for real-time updates
  - `/api/version` - App version
  - `/api/releases` - Changelog data

### Form Handling

- **Controlled components** with `useState`
- **Custom hooks** for form state (`useShiftForm`, `usePresetManagement`)
- **Client-side validation** before submission
- **Optimistic updates** where appropriate
- **Toast notifications** for feedback

### External Calendar Sync

- **iCal.js** for parsing ICS feeds
- **Automatic sync** with configurable intervals (15min - 24h)
- **Manual sync** on demand
- **Sync logs** for troubleshooting
- **Error handling** with user notifications
- **Background service** in [`lib/auto-sync-service.ts`](lib/auto-sync-service.ts)

## Code Style & Patterns

### TypeScript

- **Strict mode enabled** - No implicit `any`, strict null checks
- Always provide explicit return types for exported functions
- Use `interface` for object shapes, `type` for unions/intersections/utilities
- Prefer `const` assertions for literal types
- Use generics for reusable type-safe functions
- Export types from [`lib/types.ts`](lib/types.ts) or co-locate with implementation

### React & Next.js

- **Functional components only** - No class components
- **Server Components by default** - Add `'use client'` only when needed:
  - Interactive hooks (`useState`, `useEffect`, `onClick`)
  - Browser APIs
  - Context providers/consumers
  - Event listeners
- **Async Server Components** for data fetching
- **Server Actions** with `'use server'` for mutations
- **Metadata API** for SEO (`export const metadata` or `generateMetadata`)
- **Loading states** with `loading.tsx` or Suspense
- **Error boundaries** with `error.tsx`

### Component Patterns

- **Composition over inheritance** - Build complex components from simple ones
- **Single Responsibility Principle** - Keep components focused
- **Props interface** defined for every component
- **Extract logic into hooks** - Keep components presentational
- **Co-locate related components** - Group by feature when appropriate
- **shadcn/ui as base** - Customize from [`components/ui/`](components/ui/)

### Naming Conventions

#### Files & Folders

- **Kebab-case** for files: `calendar-grid.tsx`, `date-utils.ts`
- **PascalCase** for component files: `CalendarGrid.tsx`, `ShiftCard.tsx`
- **camelCase** for utility files: `dateUtils.ts`, `exportUtils.ts`
- **Lowercase** for Next.js special files: `page.tsx`, `layout.tsx`, `route.ts`
- Use descriptive names that indicate purpose

#### Components

- **PascalCase** for component names: `CalendarGrid`, `ShiftSheet`, `PresetSelector`
- **Suffix with component type** for clarity:
  - `*Sheet` for drawer/sheet components
  - `*Dialog` for modal dialogs
  - `*Card` for card components
  - `*Form` for form components
  - `*List` for list components

#### Functions & Variables

- **camelCase** for functions and variables: `fetchCalendars`, `isAuthenticated`
- **UPPER_SNAKE_CASE** for constants: `SESSION_MAX_AGE`, `DEFAULT_SYNC_INTERVAL`
- **Boolean prefixes**: `is`, `has`, `should`, `can`: `isLoading`, `hasError`, `shouldSync`
- **Event handler prefix**: `handle`: `handleClick`, `handleSubmit`, `handleDelete`
- **Async function prefix**: Consider `fetch` or `load`: `fetchShifts`, `loadPresets`

#### Hooks

- **Prefix with `use`**: `useAuth`, `useCalendars`, `useDebounce`
- **Descriptive names**: Indicate what data/functionality they provide
- Store in [`hooks/`](hooks/) directory

#### Types & Interfaces

- **PascalCase**: `User`, `Calendar`, `ShiftWithCalendar`
- **Suffix with purpose**: `*Props`, `*State`, `*Data`, `*Response`, `*Request`
  - `ShiftFormData` - Form data shape
  - `CalendarWithCount` - Calendar with shift count
  - `ShiftWithCalendar` - Shift with calendar join
- **Avoid `I` prefix** unless needed for clarity
- **Generic names**: `TData`, `TError` or descriptive: `Data`, `Error`

#### Database

- **snake_case** for tables and columns
- **Plural** for table names: `calendars`, `shifts`, `presets`, `users`
- **Descriptive foreign keys**: `owner_id`, `calendar_id`, `user_id`
- **Timestamp columns**: `created_at`, `updated_at`

#### API Routes

- **Plural resource names**: `/api/calendars`, `/api/shifts`
- **Dynamic segments**: `/api/calendars/[id]`
- **Action suffixes**: `/api/shifts/stats`, `/api/presets/reorder`

### Styling with Tailwind

- **Utility-first approach** - Compose styles with Tailwind classes
- **Use `cn()` utility** from [`lib/utils.ts`](lib/utils.ts) for conditional classes
- **Mobile-first responsive design** - Use `sm:`, `md:`, `lg:` breakpoints
- **Tailwind design tokens** - Use spacing scale, color palette, etc.
- **Group related utilities** for readability:
  ```tsx
  <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-card text-card-foreground">
  ```
- **Avoid inline styles** - Use Tailwind utilities
- **CSS variables** for theme colors (defined in [`app/globals.css`](app/globals.css))

### Database Patterns

- **Use Drizzle ORM** for all database operations
- **Type-safe queries** with Drizzle's query builder
- **Relations** defined in schema for joins
- **Transactions** for multi-step operations:
  ```typescript
  await db.transaction(async (tx) => {
    // Multiple operations
  });
  ```
- **Error handling** with try-catch
- **Prepared statements** for repeated queries
- **Indexes** on foreign keys and frequently queried columns

### Error Handling

- **Try-catch** in async functions and Server Actions
- **Typed error responses** from Server Actions:
  ```typescript
  return { success: false, error: "Error message" };
  ```
- **Toast notifications** for user-facing errors (via `sonner`)
- **Error boundaries** (`error.tsx`) for UI errors
- **Logging** where appropriate (consider instrumentation)
- **Graceful degradation** - Handle missing data

### Internationalization (i18n)

- **next-intl** for translations
- **useTranslations()** hook in Client Components
- **getTranslations()** in Server Components
- **Translation keys** in [`messages/`](messages/) directory
- **Supported locales**: `en`, `de`, `it`
- **Fallback** to English for missing translations
- **Type-safe** translation keys

## Best Practices

### Performance

- **Server Components** to reduce client-side JavaScript
- **Code splitting** with dynamic imports: `next/dynamic`
- **Image optimization** with `next/image` component
- **Lazy loading** for off-screen content
- **Request memoization** with React `cache()`
- **Suspense boundaries** for progressive rendering
- **Database indexes** on frequently queried columns
- **Pagination** for large datasets

### Security

- **Validate all inputs** - Server-side validation
- **Sanitize data** before database operations
- **Environment variables** for secrets ([`.env`](.env))
- **Never commit `.env`** - Use [`.env.example`](.env.example) as template
- **User authentication** via Better Auth (handles password hashing internally)
- **Session management** via Better Auth (secure httpOnly cookies)
- **Permission checks** before operations (use [`lib/auth/permissions.ts`](lib/auth/permissions.ts))
- **SQL injection prevention** via Drizzle's prepared statements

### Code Quality

- **ESLint** for code quality - Run `npm run lint`
- **TypeScript strict mode** - No `any` types
- **Consistent formatting** - Follow project conventions
- **Meaningful names** - Descriptive and clear
- **Small functions** - Single responsibility
- **DRY principle** - Extract reusable logic
- **Comments for complex logic** - Explain why, not what

### Testing

- **No formal test framework** currently
- **Manual testing** emphasized
- **Build validation** - `npm run test` runs lint + build
- **Type checking** - TypeScript as first line of defense
- **Consider adding**:
  - Unit tests for utilities
  - Integration tests for API routes
  - E2E tests for critical user flows

### Development Workflow

- **Docker Compose** for local development
- **Hot reload** with Next.js dev server
- **Database migrations** with Drizzle Kit
  - Generate: `npm run db:generate`
  - Apply: `npm run db:migrate`
  - Studio: `npm run db:studio` (GUI)
- **Environment variables** in [`.env`](.env) file
- **Version management** - Semver with npm scripts:
  - `npm run release:patch` - Bug fixes
  - `npm run release:minor` - New features
  - `npm run release:major` - Breaking changes

### Deployment

- **Self-hosted** - Docker deployment primary method
- **Database persistence** - Mount `./data` volume
- **Environment variables** configured for production
- **Build process** - `npm run build`
- **Health checks** - Version endpoint at `/api/version`

## Common Patterns & Examples

### Server Component with Data Fetching

```typescript
// app/calendars/page.tsx
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { CalendarCard } from "@/components/calendar-card";

export default async function CalendarsPage() {
  const allCalendars = await db.select().from(calendars);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Calendars</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allCalendars.map((calendar) => (
          <CalendarCard key={calendar.id} calendar={calendar} />
        ))}
      </div>
    </div>
  );
}
```

### Client Component with Hook

```typescript
// components/calendar-selector.tsx
"use client";

import { useCalendars } from "@/hooks/useCalendars";
import { Select } from "@/components/ui/select";

export function CalendarSelector() {
  const { calendars, selectedCalendar, setSelectedCalendar, loading } =
    useCalendars();

  if (loading) return <div>Loading...</div>;

  return (
    <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
      {calendars.map((cal) => (
        <option key={cal.id} value={cal.id}>
          {cal.name}
        </option>
      ))}
    </Select>
  );
}
```

### Custom Hook Pattern

```typescript
// hooks/use-shifts.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { ShiftWithCalendar } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useShifts(calendarId?: string) {
  const t = useTranslations();
  const [shifts, setShifts] = useState<ShiftWithCalendar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    if (!calendarId) return;

    try {
      const response = await fetch(`/api/shifts?calendarId=${calendarId}`);
      if (!response.ok) throw new Error("Failed to fetch shifts");

      const data = await response.json();
      setShifts(data);
    } catch (error) {
      toast.error(t("errors.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [calendarId, t]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const deleteShift = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/shifts/${id}`, { method: "DELETE" });
        setShifts((prev) => prev.filter((s) => s.id !== id));
        toast.success(t("success.deleted"));
      } catch (error) {
        toast.error(t("errors.deleteFailed"));
      }
    },
    [t]
  );

  return { shifts, loading, fetchShifts, deleteShift };
}
```

### API Route Handler

```typescript
// app/api/shifts/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { shifts, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const calendarId = request.nextUrl.searchParams.get("calendarId");

    if (!calendarId) {
      return Response.json({ error: "Calendar ID required" }, { status: 400 });
    }

    const data = await db
      .select()
      .from(shifts)
      .where(eq(shifts.calendarId, calendarId))
      .leftJoin(calendars, eq(shifts.calendarId, calendars.id));

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const [newShift] = await db.insert(shifts).values(body).returning();

    return Response.json(newShift, { status: 201 });
  } catch (error) {
    return Response.json({ error: "Failed to create shift" }, { status: 500 });
  }
}
```

### Using `cn()` Utility

```typescript
import { cn } from "@/lib/utils";

<div
  className={cn(
    "p-4 rounded-lg border",
    isActive && "bg-primary text-primary-foreground",
    isDisabled && "opacity-50 pointer-events-none"
  )}
>
  Content
</div>;
```

### Drizzle Query with Relations

```typescript
import { db } from "@/lib/db";
import { shifts, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Simple query
const allShifts = await db.select().from(shifts);

// With where clause
const calendarShifts = await db
  .select()
  .from(shifts)
  .where(eq(shifts.calendarId, "calendar-id"));

// With join
const shiftsWithCalendar = await db
  .select()
  .from(shifts)
  .leftJoin(calendars, eq(shifts.calendarId, calendars.id));

// With transaction
await db.transaction(async (tx) => {
  await tx.delete(shifts).where(eq(shifts.calendarId, calendarId));
  await tx.delete(calendars).where(eq(calendars.id, calendarId));
});
```

## Common Pitfalls to Avoid

### Server/Client Components

- ❌ Don't use `'use client'` unnecessarily
- ❌ Don't fetch data with `useEffect` in Client Components - use Server Components
- ❌ Don't pass non-serializable props to Client Components (functions, class instances)
- ✅ Do fetch data in Server Components
- ✅ Do use Server Actions for mutations
- ✅ Do mark components with `'use client'` only when using hooks/events

### TypeScript

- ❌ Don't use `any` - use `unknown` or proper types
- ❌ Don't ignore TypeScript errors with `@ts-ignore`
- ❌ Don't cast without validation (`as` assertions)
- ✅ Do use strict type checking
- ✅ Do define proper interfaces and types
- ✅ Do use type guards for runtime validation

### Database

- ❌ Don't write raw SQL - use Drizzle's query builder
- ❌ Don't forget transactions for multi-step operations
- ❌ Don't skip error handling on database operations
- ✅ Do use prepared statements
- ✅ Do handle errors gracefully
- ✅ Do add indexes on foreign keys

### Styling

- ❌ Don't use inline styles
- ❌ Don't import CSS modules unless necessary
- ❌ Don't hardcode colors - use theme variables
- ✅ Do use Tailwind utilities
- ✅ Do use `cn()` for conditional classes
- ✅ Do follow mobile-first responsive design

### State Management

- ❌ Don't create unnecessary global state
- ❌ Don't store server data in state without syncing
- ❌ Don't forget to handle loading and error states
- ✅ Do leverage Server Components for server state
- ✅ Do use local state for UI-only state
- ✅ Do use hooks to encapsulate data fetching

### Security

- ❌ Don't commit [`.env`](.env) file
- ❌ Don't expose secrets to client (use server-only imports)
- ❌ Don't trust user input - validate on server
- ❌ Don't use old password-utils or password-cache (deprecated, will be removed)
- ✅ Do validate all inputs
- ✅ Do use environment variables for secrets
- ✅ Do check permissions before operations (via Better Auth)
- ✅ Do use Better Auth's built-in methods for auth operations

## Environment Variables

### Required (if Auth Enabled)

- `BETTER_AUTH_SECRET` - Generate with `npx @better-auth/cli secret`
- `NEXT_PUBLIC_BETTER_AUTH_URL` - Auth URL (e.g., `http://localhost:3000`)

### Optional

- `NEXT_PUBLIC_AUTH_ENABLED` - Enable authentication (`true`/`false`, default: `false`)
- `NEXT_PUBLIC_ALLOW_USER_REGISTRATION` - Allow signups (default: `true`)
- `DATABASE_URL` - Database path (default: `file:./data/sqlite.db`)
- `SESSION_MAX_AGE` - Session expiration in seconds (default: `604800` = 7 days)
- `SESSION_UPDATE_AGE` - Session update interval (default: `86400` = 1 day)

### OAuth Providers (Optional)

- `GOOGLE_CLIENT_ID` + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` + `NEXT_PUBLIC_GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- `DISCORD_CLIENT_ID` + `NEXT_PUBLIC_DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET`
- Custom OIDC: `CUSTOM_OIDC_*` variables

See [`.env.example`](.env.example) for full documentation.

## Additional Resources

- **README**: [`README.md`](README.md) - Project overview and setup
- **Migration Plan**: [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) - Auth migration guidelines and status
- **Better Auth Docs**: https://www.better-auth.com/docs - Official documentation
- **Docker Setup**: [`docker-compose.yml`](docker-compose.yml), [`Dockerfile`](Dockerfile)
- **Changelog**: [`test-changelog.sh`](test-changelog.sh) - Release notes script
- **Demo**: [`demo/`](demo/) - Demo data and reset scripts

## Project-Specific Notes

- **Backwards compatibility**: Authentication is optional to support existing users
- **Feature flags**: Auth features controlled by [`lib/auth/feature-flags.ts`](lib/auth/feature-flags.ts)
- **Auth migration in progress**: See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) for implementation roadmap
- **Calendar sharing**: ✅ Multi-user access with granular permissions (owner/admin/write/read)
- **Access tokens**: 🚧 Secure link sharing for calendars (planned)
- **External sync**: Background service syncs external calendars at intervals
- **Export formats**: ICS (standard) and PDF (custom layout)
- **Recurring events**: Pattern-based recurring notes and events
- **Drag & drop**: Preset reordering uses @dnd-kit
- **SSE**: Real-time updates via Server-Sent Events at `/api/events/stream`

---

**When in doubt:**

1. Follow Next.js 15/16 App Router best practices
2. Use TypeScript strictly
3. Prefer Server Components
4. Keep components small and focused
5. Consult existing code patterns in the project
