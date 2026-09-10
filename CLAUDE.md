# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BetterShift is a self-hosted shift-planning app: Next.js 16 (App Router) + React 19, SQLite via Drizzle, better-auth, next-intl, Tailwind v4 with shadcn/ui primitives. It builds to `output: "standalone"` and ships as a Docker image.

## Commands

```bash
npm run dev            # Dev server
npm run build          # Production build — this is also the type check used in CI
npx tsc --noEmit       # Type check alone, much faster than a build
npm run lint           # ESLint (next core-web-vitals + typescript + @tanstack/query)
npm run i18n           # Translation check (see i18n below)
npm test               # lint + build + i18n — the gate before committing
npm run test:ci        # adds db:generate + db:migrate, mirrors .github/workflows/pr-checks.yml

npm run db:generate    # Create a migration after editing lib/db/schema.ts
npm run db:migrate     # Apply migrations
npm run db:studio      # Drizzle Studio
```

There is no unit-test framework here — "tests" means the lint/build/i18n pipeline. When something fails, run the individual script rather than all of `npm test`.

`npm run release:patch|minor|major` bumps the version and pushes the tag; the release workflow builds the image from it.

## Architecture

### Request flow

```
proxy.ts  →  app/api/**/route.ts  →  getSessionUser(headers)  →  permission check  →  db  →  NextResponse.json()
component →  hooks/use*.ts (TanStack Query) → fetch("/api/…") → cache keyed via lib/query-keys.ts
```

`proxy.ts` is the middleware — Next.js 16 renamed `middleware.ts` to `proxy.ts` and the export is `proxy`. It runs on almost every path (see `config.matcher`) and executes four stages in order:

1. **DB health check**, cached in-module for 10s (5s while unhealthy) with a 2s timeout. Unhealthy redirects everything to `/system-unavailable`; only `/api/health`, `/api/version`, `/api/releases` and `manifest.json` are exempt.
2. **`/share/token/[token]`** — rate limits, validates the token, writes the grant into a cookie, records usage and audit-logs it, then redirects to `/?id=<calendarId>`.
3. **Auth guard** — presence check of the better-auth session cookie only; actual session validation happens in the route handlers. Without a cookie it falls through to guest access or redirects to `/login?returnUrl=…`.
4. **Security headers + CSP** on the response.

Anything added here affects every request, so weigh cost and check the exempt list.

`instrumentation.ts` runs once per server start (Node runtime only): it preloads the version and starts `autoSyncService`. That service is an in-process `setTimeout` scheduler holding a job per external sync — not a cron job, and not shared across replicas.

### Frontend shape

The product is essentially one client page. `app/page.tsx` pulls data hooks (`useCalendars`, `useShifts`, `usePresets`, `useNotes`, `useExternalSync`), pairs them with action hooks (`useShiftActions`, `useNoteActions`) and dialog state (`useDialogStates`), and renders every sheet and dialog through `components/dialog-manager.tsx` — add new dialogs there rather than inline. Real routes exist only for `/login`, `/register`, `/profile`, `/admin/*` and `/system-unavailable`.

Purely visual preferences (shifts shown per day, note visibility, full titles) live in `localStorage` via `hooks/useViewSettings.ts`, never in the database.

### Calendar access model

Two independent questions, easy to conflate:

**May the user do X?** `getUserCalendarPermission()` in `lib/auth/permissions.ts` resolves, in priority order: owner → `calendarShares` row → access-token cookie → `calendar.guestPermission`. In routes call the wrappers `canViewCalendar` / `canEditCalendar` / `canManageCalendar` / `canDeleteCalendar` instead of touching the tables.

**Does the calendar show up in their list?** `getUserAccessibleCalendars()` additionally applies `userCalendarSubscriptions`. Shared and publicly visible calendars can be dismissed by a user (`status: "dismissed"`), the calendar-discovery sheet lets them re-subscribe, and owned calendars can never be hidden. A permission check alone therefore does not tell you whether a calendar is visible.

`AUTH_ENABLED=false` short-circuits both: every calendar becomes `owner` for everyone. Gate on `isAuthEnabled()` / `allowGuestAccess()` from `lib/auth/feature-flags.ts` rather than assuming a session exists.

Access tokens (`calendarAccessTokens`) are shareable links. `lib/auth/token-auth.ts` validates them and stores grants in a cookie that both the middleware and the API routes read back.

### Admin

Two separate permission layers, deliberately:

- `lib/auth/access-control.ts` only exists to make better-auth's admin plugin accept the `admin` and `superadmin` roles; both get all plugin permissions.
- `lib/auth/admin.ts` holds the actual rules (`canBanUser`, `canChangeUserRole`, `canResetPassword`, `canDeleteAuditLogs`, …) and is what routes under `app/api/admin/**` must check.

The first registered user is promoted to superadmin (`lib/auth/first-user.ts`).

### External calendar sync

`syncExternalCalendar()` in `app/api/external-syncs/[id]/sync/route.ts` is the single implementation, exported so the auto-sync service reuses it; the route handler is just the manual entry point. It normalises `webcal://`, fetches with a 10s abort, parses with `ical.js`, expands recurrences, splits multi-day events, and diffs against existing shifts using a fingerprint (`createEventFingerprint` / `needsUpdate` in `lib/external-calendar-utils.ts`) so unchanged events are not rewritten. Every run appends a `syncLogs` row with created/updated/deleted counts, which is what drives the sync notification dialog.

Shifts produced this way carry `syncedFromExternal` and an `externalSyncId` and are read-only — check that flag before permitting an edit or delete.

### Data layer

`lib/db/schema.ts` holds all tables and relations in one file; schema changes require `db:generate` plus `db:migrate`, and migrations under `drizzle/` are committed. `lib/db/index.ts` opens the SQLite file (`DATABASE_URL`, default `./data/sqlite.db`) at import time and creates the directory if missing — importing `db` from anything Edge-runtime will fail.

Client-side, all cache keys come from `lib/query-keys.ts`; an ad-hoc key array silently breaks invalidation. Mutations are optimistic and follow `onMutate` (cancel → snapshot → patch cache) / `onError` (roll back → toast) / `onSettled` (invalidate). `hooks/useShifts.ts` is the reference; copy its shape for new mutations.

### i18n

`messages/de.json` is the source of truth, `en`, `es`, `fr`, `it` and `cs` are mirrors. `scripts/i18n-checks.ts` flattens every locale to dot keys, greps `app/`, `components/`, `hooks/`, `lib/` for usages, and reports keys used but missing from `de.json`, keys missing from other locales, and unused keys. It runs in CI, so add the German key first, then translate. Locale resolution is server-side in `lib/i18n.ts`: `NEXT_LOCALE` cookie → `Accept-Language` → `DEFAULT_LOCALE`. A new locale also needs an entry in `lib/locales.ts`, including its `date-fns` locale — an unknown `DEFAULT_LOCALE` throws at startup.

UI strings and log output are product text in the project's locales; code comments and doc blocks stay English.

## Conventions worth knowing

- **Dates** are local `YYYY-MM-DD` strings and must never go through a UTC conversion. Use `formatDateToLocal()` / `parseLocalDate()` from `lib/date-utils.ts`, and `getDateLocale()` from `lib/locales.ts` for `date-fns` output.
- **Rate limiting**: `rateLimit(request, userId, "<type>")` returns a `NextResponse` when the limit is hit — return it immediately, otherwise continue. The valid types and their defaults are the keys of the `config` object in `lib/rate-limiter.ts`, each overridable per env var. Client-side, handle them with `isRateLimitError()` / `handleRateLimitError()`.
- **Audit logging** goes through `logUserAction` / `logAdminAction` / `logSecurityEvent` / `logSystemEvent` in `lib/audit-log.ts`. Metadata is a discriminated union — add an interface for a new action instead of passing a loose object.
- **UI primitives** in `components/ui/` are generated shadcn ("new-york") components and are not hand-edited. Sheets and dialogs compose `components/ui/base-sheet.tsx`; form logic belongs in a hook (`useShiftForm`, `useDirtyState`), not the component.

## Reference

`docs/AUTH_SETUP.md`, `docs/PERMISSIONS.md`, `docs/ADMIN_PANEL.md`, `docs/MIGRATION_AUTH_TOGGLE.md`; `.env.example` documents every environment variable with its default.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
