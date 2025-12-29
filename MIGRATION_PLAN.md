# Auth System Migration Plan

**Status**: 🔄 In Progress  
**Started**: 22. Dezember 2025  
**Target**: Better Auth mit OIDC + Username/Password  
**Goal**: Multi-User System mit Calendar Sharing & Permissions

---

## Table of Contents

1. [Phase 0: Preparation & Planning](#phase-0-preparation--planning-)
2. [Phase 1: Better Auth Installation & Basic Setup](#phase-1-better-auth-installation--basic-setup)
3. [Phase 2: Auth UI & User Experience](#phase-2-auth-ui--user-experience)
4. [Phase 3: Permission System Implementation](#phase-3-permission-system-implementation)
5. [Phase 4: Security & Infrastructure](#phase-4-security--infrastructure)
6. [Phase 5: Calendar Sharing Features](#phase-5-calendar-sharing-features)
7. [Phase 6: Calendar Access Tokens](#phase-6-calendar-access-tokens)
8. [Phase 7: Data Migration](#phase-7-data-migration)
9. [Phase 8: UI/UX Enhancements](#phase-8-uiux-enhancements)
10. [Phase 9: Admin Panel & Super Admin](#phase-9-admin-panel--super-admin)
11. [Phase 10: Testing & Documentation](#phase-10-testing--documentation)
12. [Phase 11: Performance & Polish](#phase-11-performance--polish)

---

## ⚠️ Important: Better Auth Documentation First

**Before making any auth-related changes, always check the official Better Auth documentation:**

- 📚 **Main Docs**: https://www.better-auth.com/docs
- 👥 **Users & Accounts**: https://www.better-auth.com/docs/concepts/users-accounts
- 🔑 **Authentication Methods**: https://www.better-auth.com/docs/authentication/email-password
- 🔐 **Session Management**: https://www.better-auth.com/docs/concepts/session-management
- 🛠️ **Plugins**: https://www.better-auth.com/docs/plugins/overview

**Why?**

- Better Auth provides built-in methods for most auth operations (change password, delete account, etc.)
- Custom implementations should be avoided - use Better Auth's client/server APIs
- Saves development time and ensures security best practices
- Prevents reinventing the wheel with potentially insecure code

---

## Phase 0: Preparation & Planning ✅

- [x] Analysis of current password system
- [x] Technology selection (Better Auth)
- [x] Migration strategy defined
- [x] Todo file created

---

## Phase 1: Better Auth Installation & Basic Setup

### 1.1 Dependencies Installation

- [x] Install Better Auth packages
  ```bash
  npm install better-auth
  ```
- [x] Note: No separate Drizzle adapter package needed (built-in since 1.0)
- [x] Installed with `--legacy-peer-deps` (drizzle-orm version conflict)

### 1.2 Database Schema - User Tables

- [x] Run Better Auth CLI to generate Drizzle schema:
  ```bash
  npx @better-auth/cli@latest generate
  ```
  This creates schema with:
  - `user` table (id, email, emailVerified, name, image, createdAt, updatedAt)
  - `session` table (id, userId, token, expiresAt, ipAddress, userAgent, etc.)
  - `account` table (id, userId, accountId, providerId, accessToken, password, etc.)
  - `verification` table (id, identifier, value, expiresAt, etc.)
- [x] Copy generated schema to `lib/db/schema.ts`
- [x] Update table names if needed using `modelName` property
- [x] Add Drizzle relations for joins (CLI auto-generates since 1.4)

### 1.3 Calendar Ownership Schema

- [x] Add `ownerId` column to `calendars` table
  - References `users.id`
  - Nullable (for backwards compatibility during migration)
  - `SET NULL` on user delete (orphaned calendars)
- [x] Remove `passwordHash` column from `calendars`
- [x] Remove `isLocked` column from `calendars`

### 1.4 Calendar Sharing & Permissions Schema

- [x] Create `calendarShares` table
  - `id` (text, primary key)
  - `calendarId` (text, references calendars, cascade delete)
  - `userId` (text, references users, cascade delete)
  - `permission` (text: "admin" | "write" | "read")
  - `sharedBy` (text, references users)
  - `createdAt` (timestamp)
- [x] Add unique constraint on `(calendarId, userId)`
- [x] Migration generated: `drizzle/0013_lyrical_leader.sql`

### 1.5 Better Auth Configuration

- [x] Create `lib/auth/config.ts` for Better Auth setup
- [x] Configure Drizzle adapter with correct import:
  ```typescript
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  ```
- [x] Configure credentials provider (emailAndPassword)
- [x] Configure built-in social providers:
  - [x] Google OAuth (socialProviders.google)
  - [x] GitHub OAuth (socialProviders.github)
  - [x] Discord OAuth (socialProviders.discord)
- [x] Install and configure `genericOAuth` plugin for:
  - [x] Custom OIDC provider (manual config with discoveryUrl)
- [x] Configure session settings (duration, renewal)
- [x] Add dynamic OIDC provider registration from env vars
- [x] Set experimental joins flag: `experimental: { joins: true }` (optional, for performance)

### 1.6 Auth API Routes

- [x] Create `app/api/auth/[...all]/route.ts` (Better Auth catch-all handler)
  ```typescript
  import { auth } from "@/lib/auth";
  import { toNextJsHandler } from "better-auth/next-js";
  export const { POST, GET } = toNextJsHandler(auth);
  ```
- [x] Note: Generic OAuth callback routes auto-mounted at `/oauth2/callback/:providerId`
- [x] Test basic authentication flow

### 1.7 Auth Feature Toggle

- [x] Add `AUTH_ENABLED` environment variable
- [x] Create `lib/auth/feature-flags.ts`
- [x] Implement middleware to bypass auth when disabled
- [x] Default: Auth disabled for backwards compatibility
- [x] Updated `.env.example` with all auth variables

### 1.8 Legacy System Cleanup

- [x] Remove old password checks from all API routes (16 files modified)
- [x] Create temporary compatibility types
- [x] Build verification successful
- [x] Backwards compatibility maintained (AUTH_ENABLED=false by default)

---

## Phase 2: Auth UI & User Experience

### 2.1 Login/Register Pages

- [x] Create `app/login/page.tsx`
  - Username/Password form
  - OIDC provider buttons (Google, GitHub, Discord, Custom)
  - Dynamic provider list based on enabled providers
  - "Continue as Guest" option (when auth disabled)
- [x] Create `app/register/page.tsx` (if credentials enabled)
- [x] Add proper i18n translations (de/en/it)
- [x] **Fix OIDC Registration Check**
  - [x] Check `ALLOW_USER_REGISTRATION` flag during OIDC login
  - [x] Block new user creation via OIDC when registration is disabled
  - [x] Show proper error message ("Registration disabled")
  - [x] Allow existing users to login via OIDC even when registration disabled
- [x] **Deduplicate OIDC Provider Environment Variables**
  - [x] CLIENT*ID is not secret (visible in OAuth flow), deduplicated to `NEXT_PUBLIC*\*`
  - [x] CLIENT_SECRET remains server-only (never exposed to client)
  - [x] Removed `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `DISCORD_CLIENT_ID` (server-only)
  - [x] Removed `CUSTOM_OIDC_ENABLED`, `CUSTOM_OIDC_CLIENT_ID`, `CUSTOM_OIDC_NAME` (server-only)
  - [x] Only `NEXT_PUBLIC_*_CLIENT_ID` needed for both server and client
  - [x] Updated `.env.example` to reflect simplified config
  - [x] Updated `lib/auth/env.ts` to use deduplicated variables
  - [x] Build verification successful
- [x] **UI Design Polish**
  - [x] Align login page with app design (gradients, borders, spacing)
  - [x] Align register page with app design
  - [x] Match sheet/dialog styling patterns from main app

### 2.2 User Profile & Settings

- [x] Create `app/profile/page.tsx`
  - Display user info
  - Change password UI
  - Connect/disconnect OIDC accounts UI
  - Delete account option UI
- [x] **Profile Functionality Implementation**
  - [x] Create API endpoint for password change (`/api/auth/change-password`)
  - [x] Create API endpoint for account deletion (`/api/auth/delete-account`)
  - [x] Create API endpoint for fetching accounts (`/api/auth/accounts`)
  - [x] Wire up profile page to actual API endpoints
  - [x] Add proper error handling and validation
  - [x] **Fix Connected Accounts Display**
    - [x] Query user's linked accounts from `account` table
    - [x] Display connected OAuth providers (Google, GitHub, Discord, Custom OIDC)
    - [x] Show provider name and account ID
    - [x] Fix "No connected accounts yet" showing when accounts exist
- [x] **Centralize Environment Variable Access**
  - [x] Create single source of truth for env vars (`lib/auth/env.ts`)
  - [x] Remove scattered `process.env` access in:
    - `lib/auth/config.ts` (renamed to `lib/auth/index.ts`)
    - `lib/auth/feature-flags.ts`
    - `lib/auth/client.ts`
    - `proxy.ts`
  - [x] Export typed/validated env config from central file
  - [x] Update all files to import from centralized config
- [x] **UI Design Polish**
  - [x] Align profile page with app design patterns
  - [x] Match card styling with calendar settings
  - [x] Use consistent gradients and borders
- [x] Add user menu dropdown in `AppHeader`
  - Profile link
  - Logout button
  - Show current user

### 2.3 Auth State Management ✅

- [x] Create `hooks/useAuth.ts`
  - `user` state
  - `isAuthenticated`
  - `isLoading`
  - `signIn.email()` for email/password
  - `signIn.social()` for OAuth providers
  - `signIn.oauth2()` for generic OAuth (custom OIDC)
  - `signOut()`
  - `useSession()` hook
- [x] Create `lib/auth/client.ts` (Better Auth client)
  - Import `createAuthClient` from "better-auth/react"
  - Add `genericOAuthClient()` plugin if using custom OIDC
- [x] Add session check in root layout via `AuthProvider`

### 2.4 Protected Routes ✅

- [x] Create auth proxy (`proxy.ts` - Next.js 16 convention)
- [x] Protect calendar routes (if auth enabled)
- [x] Redirect unauthenticated users to login
- [x] Store return URL for post-login redirect

---

## Phase 3: Permission System Implementation

### 3.1 Permission Utilities ✅

- [x] Create `lib/auth/permissions.ts`
  - `CalendarPermission` type: "owner" | "admin" | "write" | "read"
  - `checkPermission(userId, calendarId, required)`
  - `getUserCalendarPermission(userId, calendarId)`
  - `canViewCalendar(userId, calendarId)`
  - `canEditCalendar(userId, calendarId)`
  - `canManageCalendar(userId, calendarId)` (admin/owner)
  - `canDeleteCalendar(userId, calendarId)` (owner only)
- [x] Create `lib/auth/session.ts` helper
  - `getSessionUser(headers)` - Get current user from session
  - `isAuthenticated(headers)` - Check if user is authenticated
  - Backwards compatible: returns null/true when auth disabled

### 3.2 API Route Protection ✅

- [x] Update `app/api/calendars/route.ts`
  - GET: Return only owned + shared calendars
  - POST: Set ownerId to current user
- [x] Update `app/api/calendars/[id]/route.ts`
  - GET: Check read permission
  - PUT: Check admin permission (for rename/settings)
  - DELETE: Check owner permission
- [x] Update `app/api/shifts/route.ts`
  - GET: Check read permission
  - POST: Check write permission
- [x] Update `app/api/shifts/[id]/route.ts`
  - PUT/DELETE: Check write permission
- [x] Update `app/api/presets/route.ts`
  - GET: Check read permission
  - POST: Check write permission
- [x] Update `app/api/presets/[id]/route.ts`
  - PUT/DELETE: Check write permission
- [x] Update `app/api/presets/reorder/route.ts`
  - Check write permission
- [x] Update `app/api/notes/route.ts` & `[id]/route.ts`
  - Same permission checks as shifts
- [x] Update `app/api/external-syncs/**` routes
  - Check write permission for calendar
- [x] Update `app/api/shifts/stats/route.ts`
  - Check read permission for statistics
- [x] Update `app/api/sync-logs/route.ts`
  - GET: Check read permission
  - PATCH/DELETE: Check write permission
- [x] Update `app/api/events/stream/route.ts`
  - GET: Check read permission (SSE stream)
- [x] Update `app/api/calendars/[id]/export/ics/route.ts`
  - GET: Check read permission (ICS export)
- [x] Update `app/api/calendars/[id]/export/pdf/route.ts`
  - GET: Check read permission (PDF export)
- [x] **Security Review**: ✅ All calendar-related routes protected
- [x] **Auth Routes Review**: ✅ Change password & delete account use session auth
- [x] **Build Test**: ✅ All changes compile successfully

### 3.3 Remove Old Password System

- [x] Delete `lib/password-utils.ts`
- [x] Delete `lib/password-cache.ts`
- [x] Remove password logic from all API routes (signatures updated)
- [x] Remove password fields from creation/editing fields
- [x] Remove verify password API route (kept for backwards compatibility but unused)
- [x] Remove `usePasswordManagement` hook
- [x] Remove `usePasswordProtection` hook
- [x] Remove `PasswordDialog` component
- [x] Remove `LockedCalendarView` component
- [x] Remove `onPasswordRequired` callbacks from hooks
- [x] Remove `shouldHideUIElements` from CalendarContent
- [x] Remove `password` and `isLocked` parameters from TypeScript interfaces
- [x] Remove `passwordHash` and `isLocked` from CalendarWithCount type
- [x] **Build Test**: ✅ All changes compile successfully
- [x] Remove password-related translations
- [x] Remove `passwordHash` column from database schema

**Status**: ✅ **COMPLETED** - All functional password code removed, build passing, Migration 13 regenerated

### 3.4 Guest/Anonymous Access

**Note**: This phase covers **global public access**. For **private link sharing**, see Phase 4.5 (Access Tokens).

- [x] Add `ALLOW_GUEST_ACCESS` environment variable
  - When `true`: Allow viewing calendars without login
  - When `false`: Force login redirect (current behavior)
  - Default: `false` (require login when auth enabled)
- [x] Add `guestPermission` column to `calendars` table
  - Values: "none" (default) | "read" | "write"
  - Determines what guests can do with this calendar
  - Migration: Add column, default to "none" (0014)
- [x] Update permission utilities (`lib/auth/permissions.ts`)
  - Extend `getUserCalendarPermission()` to handle guest users
  - Return guest permission if no user session
  - Guest permissions never override user permissions
- [x] Update `proxy.ts` middleware
  - Skip login redirect if `ALLOW_GUEST_ACCESS=true`
  - Allow unauthenticated users to view app
- [x] Update API route protection
  - Accept requests without auth session (if guest access enabled)
  - Apply guest permissions in all routes
  - Block write operations if guest permission < write
  - Return only guest-accessible calendars (Option 1: Security first)
  - Fixed 6 bugs in external-syncs routes (missing `await` on permission checks)
- [x] **UI Updates for Guest Mode (Complete)**
  - [x] **Core Components Implemented:**
    - `useAuth` Hook: Added `isGuest` flag for client-side guest detection
    - `GuestBanner` Component: Full banner + compact variant with login button
    - `ReadOnlyBanner` Component: Reusable banner for read-only sheets/dialogs
    - `useCalendarPermission` Hook: Client-side permission checking helper
  - [x] **Translations:** Added for all 3 languages (en, de, it)
  - [x] **Guest Banner Display:**
    - Integrated in `calendar-content.tsx` (shown above calendar grid)
    - Two variants: default (full) and compact
    - Shows "Sign in for full access" button with link to `/login`
  - [x] **Calendar Settings:**
    - Guest Permission section added (owner/admin only)
    - Radio buttons: "No Access" | "Read Only" | "Read & Write"
    - Explanatory descriptions for each option
    - Icons: AlertTriangle (none), Eye (read), Edit (write)
    - Only visible when `ALLOW_GUEST_ACCESS=true`
  - [x] **Read-only Mode:**
    - [x] `shift-sheet.tsx`: Read-only support with banner
    - [x] `shift-form-fields.tsx`: All inputs disabled when `readOnly=true`
    - [x] `color-picker.tsx`: Added `disabled` prop support
    - [x] `note-sheet.tsx`: Complete with ReadOnlyBanner, all inputs disabled, save/delete buttons hidden
    - [x] `preset-manage-sheet.tsx`: Complete with ReadOnlyBanner, edit/delete/add buttons hidden
    - [x] `notes-list-dialog.tsx`: Complete with ReadOnlyBanner, edit/delete/add buttons hidden
    - [x] `shifts-overview-dialog.tsx`: Read-only by nature (no changes needed)
    - [x] `calendar-compare-sheet.tsx`: Read-only by nature (no changes needed)
  - [x] **Calendar Selector Enhancements:**
    - [x] Lock icons for read-only calendars in dropdown
    - [x] Tooltips showing "Read-only access" on selected calendar
    - [x] Visual indicators in both desktop and mobile variants
    - [x] Created `components/ui/tooltip.tsx` (Radix UI tooltip component)
  - [x] **App Header:**
    - [x] Show "Login" button for guests (replaces UserMenu)
    - [x] Implemented in both desktop and mobile layouts
  - [x] **Login Page:**
    - [x] "Continue as Guest" button (when `ALLOW_GUEST_ACCESS=true`)
    - [x] Properly handles returnUrl after guest browsing
  - [x] **Special Cases:**
    - [x] `export-dialog.tsx`: Works for read-only (no changes needed)
    - [x] `view-settings-sheet.tsx`: Works normally (local UI only)
- [x] Calendar Settings Sheet
  - [x] Add "Guest Access" section (owner/admin only)
  - [x] Radio buttons: "No Access" | "Read Only" | "Read & Write"
  - [x] Explanation text about guest behavior

**Status**: ✅ **COMPLETED** - All backend and UI features implemented and tested

**Components Completed (8/8):**

1. ✅ shift-sheet.tsx - Read-only mode with banner
2. ✅ shift-form-fields.tsx - All inputs disabled
3. ✅ color-picker.tsx - Disabled prop support
4. ✅ note-sheet.tsx - Full read-only implementation
5. ✅ preset-manage-sheet.tsx - Full read-only implementation
6. ✅ notes-list-dialog.tsx - Full read-only implementation
7. ✅ shifts-overview-dialog.tsx - Read-only by design
8. ✅ calendar-compare-sheet.tsx - Read-only by design

**Implementation Complete:**

- ✅ Guest detection (useAuth with isGuest flag)
- ✅ Permission checking (useCalendarPermission hook - **enhanced to accept both calendar object and calendarId string**)
- ✅ Reusable components (GuestBanner, ReadOnlyBanner)
- ✅ Translations (en, de, it - 18 new translation keys)
- ✅ API route protection (all routes respect guest permissions)
- ✅ Calendar settings UI (guest permission controls)
- ✅ Read-only mode (all 8 components use permission-based logic instead of isGuest)
- ✅ Calendar selector (lock icons + tooltips)
- ✅ App header (guest login button)
- ✅ Login page (Continue as Guest button)
- ✅ Build verification (TypeScript compilation successful)
- ✅ **Consistency Fix (26. Dez 2025):** All UI components now respect `guestPermission` setting correctly
  - Previously: Components treated ALL guests as read-only (ignoring guestPermission)
  - Now: Components use `useCalendarPermission` hook to check actual permission level
  - Result: Guests with `write` permission can now edit shifts, presets, and notes as intended

**Testing Checklist:**

1. ✅ Set `NEXT_PUBLIC_ALLOW_GUEST_ACCESS=true` in `.env`
2. ✅ Verify guest banner appears
3. ✅ Test read-only mode in all sheets/dialogs
4. ✅ Check lock icons in calendar selector
5. ✅ Verify "Login" button shows in header for guests
6. ✅ Test "Continue as Guest" button on login page
7. ✅ Verify no redirect to login when guest access enabled

**Bug Fixes:**

- ✅ Fixed `allowGuestAccess()` requiring auth to be disabled (should work with auth enabled)
- ✅ Fixed "Continue as Guest" button causing redirect loop (use `router.replace` instead of `router.push`)

**Use Cases**:

- Public calendars (team shifts visible to everyone)
- Demo mode (showcase app without registration)
- Shared family calendar (view-only for relatives)
- Gradual auth adoption (allow browsing before committing)

**Difference from Access Tokens (Phase 4.5)**:

- **Guest Access**: Calendar is public to ALL visitors (like making a Reddit post public)
- **Access Tokens**: Calendar is private, shared via secure link (like Google Docs share link)

**Security Considerations**:

- Guest permissions never override user permissions (user = stricter rules)
- Owner/admin required to change guest settings
- Rate limiting applies to guest requests
- No sensitive data exposed to guests (user info, emails, etc.)
- Requires Phase 3.1 & 3.2 to be completed first

### 3.5 User Calendar Subscriptions (Guest Calendar Discovery)

**Priority**: Medium

**Goal**: Allow authenticated users to selectively subscribe to public guest calendars (opt-in model) with dismiss/re-subscribe functionality.

**Problem**: When auth is enabled, authenticated users currently only see:

- Their own calendars (owner)
- Explicitly shared calendars (calendarShares - auto-visible)

But NOT calendars with `guestPermission != "none"` (public calendars) unless explicitly subscribed.

**Solution**: Subscription + Dismissal system where users can:

- Discover and subscribe to public calendars
- Dismiss shared calendars (hide them from view)
- Re-subscribe to dismissed calendars
- No duplicate subscriptions (one calendar = one visibility state)

**Key Behaviors**:

- **Owned calendars** (ownerId): Always visible, CANNOT be dismissed
- **Shared calendars** (calendarShares): Auto-visible, CAN be dismissed, can be re-subscribed
- **Public calendars** (guestPermission): Hidden by default, CAN be subscribed
- **Permission hierarchy**: Share permissions > Guest permissions (no double subscription)

#### 3.5.1 Database Schema - Subscriptions & Dismissals

- [x] Create `userCalendarSubscriptions` table in `lib/db/schema.ts`
  ```typescript
  export const userCalendarSubscriptions = sqliteTable(
    "user_calendar_subscriptions",
    {
      id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      calendarId: text("calendar_id")
        .notNull()
        .references(() => calendars.id, { onDelete: "cascade" }),
      createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
      // Unique constraint: user can only subscribe once per calendar
      uniqueUserCalendar: unique().on(table.userId, table.calendarId),
      // Indexes for fast lookups
      userIdIdx: index("user_calendar_subscriptions_userId_idx").on(
        table.userId
      ),
      calendarIdIdx: index("user_calendar_subscriptions_calendarId_idx").on(
        table.calendarId
      ),
    })
  );
  ```
- [x] Create `userCalendarDismissals` table in `lib/db/schema.ts`
  ```typescript
  export const userCalendarDismissals = sqliteTable(
    "user_calendar_dismissals",
    {
      id: text("id")
        .primaryKey()
        .$defaultFn(() => createId()),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      calendarId: text("calendar_id")
        .notNull()
        .references(() => calendars.id, { onDelete: "cascade" }),
      createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => ({
      // Unique constraint: user can only dismiss once per calendar
      uniqueUserCalendar: unique().on(table.userId, table.calendarId),
      // Indexes for fast lookups
      userIdIdx: index("user_calendar_dismissals_userId_idx").on(table.userId),
      calendarIdIdx: index("user_calendar_dismissals_calendarId_idx").on(
        table.calendarId
      ),
    })
  );
  ```
- [x] Add relations to schema

  ```typescript
  // In userRelations
  calendarSubscriptions: many(userCalendarSubscriptions),
  calendarDismissals: many(userCalendarDismissals),

  // In calendarsRelations
  subscriptions: many(userCalendarSubscriptions),
  dismissals: many(userCalendarDismissals),

  // New relations
  export const userCalendarSubscriptionsRelations = relations(userCalendarSubscriptions, ({ one }) => ({
    user: one(user, { fields: [userCalendarSubscriptions.userId], references: [user.id] }),
    calendar: one(calendars, { fields: [userCalendarSubscriptions.calendarId], references: [calendars.id] }),
  }));

  export const userCalendarDismissalsRelations = relations(userCalendarDismissals, ({ one }) => ({
    user: one(user, { fields: [userCalendarDismissals.userId], references: [user.id] }),
    calendar: one(calendars, { fields: [userCalendarDismissals.calendarId], references: [calendars.id] }),
  }));
  ```

- [x] Generate migration: `npm run db:generate`
  - [x] Apply migration: `npm run db:migrate`

#### 3.5.2 Permission Logic Update

- [x] Update `lib/auth/permissions.ts` - `getUserAccessibleCalendars()`

  ```typescript
  // Visibility Logic:
  // 1. Owned calendars (ownerId = userId) - Always visible, cannot be dismissed
  // 2. Explicitly shared calendars (calendarShares) - Auto-visible, can be dismissed
  // 3. Subscribed public calendars (userCalendarSubscriptions + guestPermission != "none")

  // Filter out dismissed calendars (userCalendarDismissals)
  // Owned calendars ignore dismissals (always shown)

  // Permission Priority (for same calendar):
  // - Share permission > Guest permission (use best available, no duplicates)
  ```

- [x] Implement permission hierarchy:
  - **Owner permission** (ownerId): Always visible, CANNOT be dismissed, full control
  - **Share permission** (calendarShares): Auto-visible, CAN be dismissed, permission as defined in share
  - **Guest permission** (guestPermission): Hidden by default, can be subscribed, permission as defined in calendar
- [x] Return calendar visibility metadata:

  ```typescript
  Array<{
    id: string;
    permission: CalendarPermission; // Best available permission
    source: "owner" | "share" | "subscription"; // Primary source
    canDismiss: boolean; // false for owner, true for share/subscription
    isDismissed: boolean; // Current dismissal state
  }>;
  ```

- [x] Create helper functions:

  ```typescript
  // Check if calendar is dismissed by user
  async function isCalendarDismissed(
    userId: string,
    calendarId: string
  ): Promise<boolean>;

  // Dismiss a calendar (not allowed for owned calendars)
  async function dismissCalendar(
    userId: string,
    calendarId: string
  ): Promise<void>;

  // Re-subscribe (remove dismissal) - works for both shares and subscriptions
  async function undismissCalendar(
    userId: string,
    calendarId: string
  ): Promise<void>;
  ```

#### 3.5.3 Subscription & Dismissal API

- [x] Create `app/api/calendars/subscriptions/route.ts`
  - **GET**: List all available public calendars for discovery
    - Returns calendars with `guestPermission != "none"`
    - Excludes user's owned calendars (ownerId = userId)
    - Excludes calendars user already has access to (via calendarShares OR userCalendarSubscriptions AND NOT dismissed)
    - Includes subscription/dismissal status for each calendar
    - Shows dismissed shared calendars (so they can be re-subscribed)
    - Requires authentication
  - **POST**: Subscribe to a calendar
    - Body: `{ calendarId: string }`
    - Two scenarios:
      1. New public calendar subscription: Creates entry in `userCalendarSubscriptions`
      2. Re-subscribing dismissed calendar: Removes entry from `userCalendarDismissals`
    - Validates calendar has `guestPermission != "none"` OR user has `calendarShares` entry
    - Prevents subscribing to own calendars (return error)
    - Returns success or error
- [x] Create `app/api/calendars/subscriptions/[calendarId]/route.ts`
  - **DELETE**: Dismiss/Unsubscribe from a calendar
    - Two scenarios:
      1. Shared calendar: Creates entry in `userCalendarDismissals` (hide but keep share)
      2. Subscribed public calendar: Removes from `userCalendarSubscriptions`
    - Validates user is not owner (cannot dismiss own calendars)
    - Returns success
- [x] Update `app/api/calendars/route.ts` (GET)
  - Apply dismissal filter to returned calendars
  - Use updated `getUserAccessibleCalendars()` logic

#### 3.5.4 Discovery UI Components

- [x] Create `components/calendar-discovery-dialog.tsx`

  - Title: "Browse Calendars" / "Calendar Discovery"
  - Two tabs/sections:
    1. **"Public Calendars"** - Calendars with guestPermission (not owned, not already visible)
    2. **"Dismissed Calendars"** - Shared/subscribed calendars user has hidden
  - For each calendar:
    - Calendar name + color indicator
    - Permission badge (Read-only / Read & Write)
    - Owner name (if available)
    - Source badge ("Public" / "Shared with you")
    - Subscribe/Re-subscribe button
    - Show "You own this calendar" for owned calendars (shouldn't appear but defensive)
  - Search/filter functionality
  - Empty states:
    - "No public calendars available" (Public tab)
    - "No dismissed calendars" (Dismissed tab)
  - Loading states

- [x] Add "Browse Calendars" button trigger
  - **Placement**: In User Menu dropdown (`components/user-menu.tsx`)
    ```tsx
    <DropdownMenuItem onClick={onBrowseCalendars}>
      <Users className="h-4 w-4 mr-2" />
      {t("calendar.browseCalendars")}
    </DropdownMenuItem>
    ```
  - Position: Between "Profile" and "Logout" items
  - Icon: `Users` (represents public/community calendars)
  - Only visible for authenticated users (not guests)

#### 3.5.5 Subscription & Dismissal Hooks

- [x] Create `hooks/useCalendarSubscriptions.ts`

  ```typescript
  export function useCalendarSubscriptions() {
    const [availableCalendars, setAvailableCalendars] = useState([]);
    const [dismissedCalendars, setDismissedCalendars] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCalendars = async () => {
      // GET /api/calendars/subscriptions
      // Returns { public: [], dismissed: [] }
    };

    const subscribe = async (calendarId: string) => {
      // POST /api/calendars/subscriptions
      // Handles both new subscriptions and re-subscribing dismissed calendars
      // Refresh calendar list after success
    };

    const dismiss = async (calendarId: string) => {
      // DELETE /api/calendars/subscriptions/[calendarId]
      // Handles both dismissing shares and unsubscribing from public calendars
      // Refresh calendar list after success
    };

    return {
      availableCalendars, // Public calendars not yet subscribed
      dismissedCalendars, // Shared/subscribed calendars user has hidden
      loading,
      subscribe,
      dismiss,
      refresh: fetchCalendars,
    };
  }
  ```

- [x] Update `hooks/useCalendars.ts`
  - Fetch should automatically exclude dismissed calendars (via updated API)
  - No additional client-side filtering needed if API is correct

#### 3.5.6 UI/UX Enhancements

- [x] Calendar Selector updates

  - Add context menu option "Dismiss calendar" for shared/subscribed calendars
  - Show visual indicator for subscribed public calendars (optional icon/badge)
  - Disabled "Dismiss" option for owned calendars

- [x] Calendar Settings Sheet

  - Show calendar source: "You own this" / "Shared with you" / "Public subscription"
  - For shared calendars: Add "Dismiss this calendar" button
  - For subscribed calendars: Add "Unsubscribe from this calendar" button
  - Owned calendars: No dismiss option

- [x] Translations
  - Add translation keys (en, de, it):
    - `calendar.browseCalendars` - "Browse Calendars" (User Menu + Dialog title)
    - `calendar.publicCalendars` - "Public Calendars" (Tab label)
    - `calendar.dismissedCalendars` - "Dismissed Calendars" (Tab label)
    - `calendar.subscribe` - "Subscribe"
    - `calendar.resubscribe` - "Re-subscribe"
    - `calendar.dismiss` - "Dismiss"
    - `calendar.subscribed` - "Subscribed"
    - `calendar.youOwnThis` - "You own this calendar"
    - `calendar.noPublicCalendars` - "No public calendars available"
    - `calendar.noDismissedCalendars` - "No dismissed calendars"
    - `calendar.subscriptionSuccess` - "Successfully subscribed to {name}"
    - `calendar.dismissSuccess` - "Calendar dismissed"
    - `calendar.resubscribeSuccess` - "Calendar restored"
    - `calendar.cannotDismissOwn` - "You cannot dismiss your own calendar"
    - `calendar.sharedWithYou` - "Shared with you"
    - `calendar.publicSubscription` - "Public subscription"
    - `calendar.dismissCalendar` - "Dismiss this calendar"
    - `calendar.unsubscribeCalendar` - "Unsubscribe from this calendar"

#### 3.5.7 Guest Behavior (Non-Authenticated Users)

**Important**: Guests (non-authenticated users) are NOT affected by this feature.

- Guests continue to see ALL calendars with `guestPermission != "none"` automatically
- No subscription or dismissal system for guests (cannot persist preferences without account)
- Current behavior in Phase 3.4 remains unchanged for guests

#### 3.5.8 Migration & Backwards Compatibility

- [x] Existing calendars: No automatic subscriptions or dismissals created
- [x] Users will see owned + explicitly shared calendars by default (current behavior)
- [x] Public calendars hidden by default (require manual subscription via discovery dialog)
- [x] No breaking changes to existing functionality

### 3.6 Fixes & Polish

- [x] Fix calendar selector not live updating after calendar subscription/dismissal
  - **Root Cause**: SSE events are filtered by `calendarId` in stream, so subscription/dismissal events for other calendars were not received
  - **Solution**: Dispatch custom `calendar-list-change` events directly from `useCalendarSubscriptions` hook after successful subscribe/dismiss actions
  - **Changes**:
    - `useCalendarSubscriptions.ts`: Dispatch `window.dispatchEvent(new CustomEvent('calendar-list-change'))` after subscribe/dismiss
    - `useCalendars.ts`: Listen to `calendar-list-change` events and trigger `fetchCalendars()` on receive
    - Removed redundant SSE event listener in `useCalendarSubscriptions` (not needed since we dispatch custom events)
  - **Result**: Calendar selector now updates immediately when user subscribes/dismisses calendars from discovery dialog

---

## Phase 4: Security & Infrastructure

**Priority**: Critical (Before Production)

**Goal**: Implement security hardening, audit logging, session management, and background service protection.

### 4.1 Rate Limiting & Security Hardening ✅

**Priority**: Critical (Before Production)

**Goal**: Protect API endpoints from brute-force attacks and abuse using in-memory rate limiting.

**Status**: COMPLETED (28. Dezember 2025)

- [x] Create `lib/rate-limiter.ts`
  - Implement LRU cache-based rate limiter (no external dependencies)
  - Configurable limits per endpoint
  - Track requests by IP address or user ID
  - Return rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [x] Rate Limiting Configuration
  - Auth endpoints: 5 requests per 60 seconds (login)
  - Register: 3 requests per 10 minutes (stricter to prevent spam)
  - Password change: 3 requests per hour
  - Account deletion: 1 request per hour
  - Avatar upload: 5 requests per 5 minutes
  - SSE connections: 3 per user per 10 seconds (allow page reloads)
  - Calendar creation: 10 requests per hour
  - External sync: 5 requests per 5 minutes (per calendar)
  - PDF export: 10 requests per 10 minutes
- [x] Integrate Rate Limiter
  - [x] Update `app/api/auth/[...all]/route.ts` - Apply to POST requests, distinguish register vs login
  - [x] Update `app/api/auth/change-password/route.ts` - Strict limit
  - [x] Update `app/api/auth/delete-account/route.ts` - Strict limit
  - [x] Update `app/api/auth/upload-avatar/route.ts` - Strict limit
  - [x] Update `app/api/events/stream/route.ts` - Connection limit
  - [x] Update `app/api/calendars/route.ts` - POST endpoint (calendar creation)
  - [x] Update `app/api/external-syncs/[id]/sync/route.ts` - Sync endpoint (per calendar)
  - [x] Update `app/api/calendars/[id]/export/pdf/route.ts` - PDF export endpoint
- [x] Error Handling
  - Return `429 Too Many Requests` with retry-after header
  - Show user-friendly toast message on client with formatted retry time
  - Log rate limit violations for monitoring
  - Client utilities: `isRateLimitError()`, `handleRateLimitError()` in `lib/rate-limit-client.ts`
- [x] UI Error Handling
  - [x] Login page (`app/login/page.tsx`)
  - [x] Register page (`app/register/page.tsx`)
  - [x] Profile page password/delete/avatar (`app/profile/page.tsx`)
  - [x] Calendar creation (`hooks/useCalendars.ts`)
  - [x] External sync (`components/external-sync-manage-sheet.tsx`)
  - [x] PDF export (`components/export-dialog.tsx`)
- [x] Remove unused default rate limit
  - Removed from `lib/rate-limiter.ts` config
  - Removed from `.env.example`
  - Removed from all switch cases

**Implementation Notes**:

- Use Map with TTL for in-memory storage
- No Redis/external database required
- Rate limits reset on server restart (acceptable for self-hosted)
- Fixed window algorithm for simplicity
- External sync rate limit per calendar (allows multiple calendars to sync independently)
- Better Auth client wraps 429 errors - requires checking `result.error.status === 429`
- All user-facing errors show retry time in user-friendly format (minutes/hours, not seconds)

### 4.2 Audit Logging & Activity Logs System ✅

**Priority**: Medium

**Goal**: Track security events, user actions, and calendar activities for compliance, troubleshooting, and user transparency.

**Architecture**: Two-tier logging system:

1. **Audit Logs** - All events (admin view in Phase 9)
2. **Activity Logs** - User-visible events (per-user view)

#### 4.2.1 Database Schema - Audit Logs ✅

- [x] Create `auditLogs` table in `lib/db/schema.ts`
  - `id` (text, primary key, UUID)
  - `userId` (text, nullable, references users, SET NULL on delete)
  - `action` (text, not null) - Action type (e.g., "auth.login.failed", "calendar.created")
  - `resourceType` (text, nullable) - "user", "calendar", "share", "sync", "session"
  - `resourceId` (text, nullable) - ID of affected resource
  - `metadata` (text, nullable) - JSON string with typed metadata per action
  - `ipAddress` (text, nullable) - Client IP (supports Docker + Cloudflare + direct)
  - `userAgent` (text, nullable) - Browser/device info
  - `severity` (text, not null) - "info" | "warning" | "error" | "critical"
  - `isUserVisible` (boolean, not null, default false) - Show in user's activity log
  - `timestamp` (timestamp, not null, default: current timestamp)
- [x] Add indexes:
  - `(userId, timestamp)` - User activity queries
  - `(action, timestamp)` - Admin filtering
  - `(isUserVisible, userId, timestamp)` - User activity log queries
- [x] Generate migration: `npm run db:generate`

#### 4.2.2 IP Address Extraction Helper ✅

- [x] Create `lib/ip-utils.ts`
  - `getClientIp(request: NextRequest): string | null` - Extract real client IP
  - Support multiple proxy scenarios:
    - Direct connection: `request.ip`
    - Docker/reverse proxy: `X-Forwarded-For` (first IP)
    - Cloudflare: `CF-Connecting-IP` (highest priority)
    - Fallback: `X-Real-IP`
  - Return first non-internal IP address
  - Handle IPv6 addresses

#### 4.2.3 Audit Logging Helper ✅

- [x] Create `lib/audit-log.ts`
  - TypeScript interfaces for typed metadata per action:
    ```typescript
    interface LoginFailedMetadata {
      email: string;
      reason: "invalid_password" | "user_not_found" | "rate_limited";
    }
    interface CalendarCreatedMetadata {
      calendarName: string;
      color: string;
    }
    interface CalendarSharedMetadata {
      sharedWith: string; // user email
      permission: "read" | "write" | "admin";
    }
    // ... more interfaces per event type
    ```
  - `logAuditEvent<T>(options)` function:
    - Parameters: `{ action, userId?, resourceType?, resourceId?, metadata: T, request?, severity, isUserVisible }`
    - Extract IP address and user agent from request
    - Store event in database (fire-and-forget via `queueMicrotask()` - don't block request)
    - Type-safe metadata based on action type
  - Helper functions:
    ```typescript
    logSecurityEvent(); // severity: critical, isUserVisible: true
    logUserAction(); // severity: info, isUserVisible: true
    logAdminAction(); // severity: warning, isUserVisible: false
    logSystemEvent(); // severity: info, isUserVisible: false
    ```

#### 4.2.4 Events to Log

**Security Events** (User-visible, Critical):

- [x] **Failed login attempts** - `lib/auth/audit-plugin.ts`
  - Action: `"auth.login.failed"`
  - Metadata: `{ email, reason }`
  - Tracked via Better Auth hooks (after hook on `/sign-in/email`)
- [x] **Successful logins** (Optional - can be many)
  - Action: `"auth.login.success"`
  - Metadata: `{ email, newDevice: boolean }`
  - Tracked via Better Auth hooks (after hook on `/sign-in/email`)
- [x] **User registration** - `lib/auth/audit-plugin.ts`
  - Action: `"auth.user.registered"`
  - Metadata: `{ email, name, registrationMethod: "email" | "oauth_google" | "oauth_github" | "oauth_discord" }`
  - Tracked via Better Auth hooks (after hook on `/sign-up/email`)
- [x] **Profile updated** - `lib/auth/audit-plugin.ts`
  - Action: `"auth.profile.updated"`
  - Metadata: `{ changes: string[], newValues: { name?, email? } }`
  - Tracked via Better Auth hooks (after hook on `/update-user`)
- [x] **Password changes** - `app/api/auth/change-password/route.ts`
  - Action: `"auth.password.changed"`
  - Metadata: `{ sessionsRevoked: number }`
- [x] **Account deletion** - `app/api/auth/delete-account/route.ts`
  - Action: `"auth.account.deleted"`
  - Metadata: `{ calendarsDeleted: number }`

**Calendar Events** (User-visible, Info):

- [x] **Calendar created** - `app/api/calendars/route.ts`
  - Action: `"calendar.created"`
  - Metadata: `{ calendarName, color }`
- [x] **Calendar deleted** - `app/api/calendars/[id]/route.ts`
  - Action: `"calendar.deleted"`
  - Metadata: `{ calendarName, shiftsDeleted: number, presetsDeleted: number, notesDeleted: number }`
- [x] **Calendar settings changed** - `app/api/calendars/[id]/route.ts`
  - Action: `"calendar.updated"`
  - Metadata: `{ calendarName, changes: string[] }` (e.g., ["name", "color", "guestPermission"])

**External Sync Events** (User-visible, Info/Warning):

- [x] **External sync added** - `app/api/external-syncs/route.ts`
  - Action: `"sync.created"`
  - Metadata: `{ calendarName, syncUrl, syncName }`
- [x] **External sync removed** - `app/api/external-syncs/[id]/route.ts`
  - Action: `"sync.deleted"`
  - Metadata: `{ calendarName, syncUrl, syncName }`
- [x] **External sync executed** - `app/api/external-syncs/[id]/sync/route.ts`
  - Action: `"sync.executed"`
  - Metadata: `{ calendarName, syncName, shiftsAdded: number, shiftsUpdated: number, shiftsDeleted: number, success: boolean, error?: string }`
  - Severity: `success ? "info" : "warning"`

**Rate Limit Events** (User-visible, Warning):

- [x] **Rate limit hit** - `lib/rate-limiter.ts`
  - Action: `"security.rate_limit.hit"`
  - Metadata: `{ endpoint: string, limit: number, resetTime: number }`

#### 4.2.5 Activity Logs API (User-facing)

- [x] Create `app/api/activity-logs/route.ts`
  - **GET**: List user's visible activity logs (merged from auditLogs + syncLogs)
    - Merge data from two sources:
      1. `auditLogs` table (where `isUserVisible = true AND userId = currentUser`)
      2. `syncLogs` table (converted to unified activity format)
    - Query params: `?type=` (auth/calendar/sync), `?startDate=`, `?endDate=`
    - Pagination: `?page=`, `?limit=` (default 50, max 100)
    - Sort: Combined by timestamp DESC
    - Returns: `{ logs: UnifiedActivityLog[], total: number, page: number, hasMore: boolean }`
  - **DELETE**: Clear user's activity logs
    - Only delete logs where `userId = currentUser` AND `isUserVisible = true`
    - Cannot delete admin/system logs
- [x] Extend GET endpoint to merge syncLogs
  - Query syncLogs for user's calendars
  - Convert syncLog entries to unified format:
    ```typescript
    {
      id: string,
      type: "sync" | "auth" | "calendar" | "security",
      action: string,
      timestamp: Date,
      severity: string,
      metadata: object,
      resourceType?: string,
      resourceId?: string,
      isRead?: boolean, // Only for sync events
    }
    ```
  - Merge with auditLogs, sort by timestamp
  - Handle pagination across both data sources

#### 4.2.6 Activity Log Page UI (User-facing)

**Location**: `/profile/activity` (new dedicated page)

**Design**: Professional audit log viewer with full-screen table layout

**Status**: ✅ **COMPLETED** (28. Dezember 2025)

**Mobile Optimization & Design Updates (28. Dezember 2025)**:

- ✅ Mobile-responsive layout (full width on mobile: `max-w-full sm:max-w-4xl`, reduced padding: `px-2 sm:px-4`)
- ✅ Removed mobile warning (page is now properly optimized for mobile)
- ✅ Applied profile page design system:
  - Gradient background: `bg-gradient-to-br from-background via-background to-primary/5`
  - Card gradient: `bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm`
  - Title gradient: `bg-gradient-to-r from-foreground via-foreground to-foreground/70`
- ✅ Compact table cells on mobile (p-2 sm:p-3 instead of p-3)
- ✅ Hide button labels on mobile (show only icons for Refresh, Mark All Read, Clear All)
- ✅ Toast feedback on refresh button (`activityLog.refreshed` translation added)
- ✅ Responsive actions row (flex-wrap for better mobile layout)

- [x] Create `app/profile/activity/page.tsx`
  - Full-width table layout (not constrained by profile container)
  - Columns: Time, Event Type, Action, Resource, Details, Status
  - Sortable columns (click header to sort timestamp, type, severity)
  - Expandable rows for JSON metadata (click any row)
  - Empty state: "No activity recorded yet"
  - Loading skeleton during fetch
- [x] Advanced Filters (top bar)
  - Event Type dropdown: All / Auth / Calendar / Sync / Security
  - Date Range Picker (startDate → endDate) - using react-day-picker with 2-month view
  - Severity Filter: All / Info / Warning / Error / Critical
  - Search box: Filter by action, resource, or ID (client-side)
  - "Clear Filters" button (shows when any filter active)
- [x] Table Features
  - Sortable columns (timestamp, type, severity)
  - Pagination controls (Previous / Next + showing X-Y of Z)
  - Color-coded severity badges (blue/yellow/orange/red)
  - Color-coded type badges (purple=auth, green=calendar, cyan=sync, red=security)
  - Expandable details row (show full metadata JSON with syntax highlighting)
  - Timestamp in locale format (MMM dd, yyyy HH:mm:ss)
  - Unread indicator for sync events (blue background + "New" badge)
- [x] Actions
  - "Clear All Activity" button (confirmation dialog)
  - "Mark All as Read" button (for sync events with isRead flag)
  - "Refresh" button to reload data
  - Shows total log count + unread count in header
- [x] Navigation & Access
  - Add "Activity Log" link to User Menu dropdown (with FileText icon)
  - Badge on User Menu showing unread count (red badge on avatar, blue badge in menu item)
  - Auto-refresh unread count every 30 seconds
- [x] Create `hooks/useActivityLogs.ts`
  - Fetch logs from `/api/activity-logs` with filters
  - State: `logs`, `filteredLogs`, `loading`, `error`, `total`, `hasMore`, `unreadCount`
  - Actions: `fetchLogs()`, `clearLogs()`, `markAllRead()`, `markLogsRead(ids)`, `fetchUnreadCount()`
  - Client-side filters: severity, search (applied after API response)
  - Server-side filters: type, dateRange (sent to API)
  - Pagination management: `goToNextPage()`, `goToPreviousPage()`
- [x] Responsive Design
  - Desktop: Full table with all columns visible
  - Tablet/Mobile: Horizontal scroll for table (keeps all data accessible)
- [x] shadcn/ui Components Created
  - `components/ui/calendar.tsx` - Calendar component (react-day-picker wrapper)
  - `components/ui/popover.tsx` - Popover primitive (Radix UI)
  - `components/ui/date-range-picker.tsx` - Custom date range picker with 2-month view

**Keep syncLogs table**: Used for technical sync details + `isRead` badge logic. Both `syncLogs` and `auditLogs` coexist - merged in API for unified timeline.

#### 4.2.7 Translations

**Status**: ✅ **COMPLETED** (28. Dezember 2025)

**Note**: Admin Panel Audit Logs UI moved to Phase 9.4

**Implementation Notes**:

- Use `crypto.randomUUID()` for log IDs
- Store metadata as JSON string, parse on read
- Fire-and-forget logging (don't block API responses)
- Indexes critical for performance on large datasets
- IP extraction supports Docker, Cloudflare, and direct connections

**Note**: Email-Verification will be deliberately **not** enforced - the `emailVerified` field exists but is not used.

### 4.3 Session Management UI

**Priority**: Medium (Low Priority, Full Features)

**Goal**: Give users visibility and control over their active sessions.

**Audit Logging**:

- [ ] **Sessions revoked** - Session management API

  - Action: `"auth.session.revoked"`
  - Metadata: `{ revokedBy: 'user' | 'password_change' | 'admin' }`
  - Integrate into session revocation endpoints below

- [ ] Database Query Helper
  - [ ] Create `lib/auth/sessions.ts`
    - `getUserSessions(userId)` - Fetch all active sessions for user
    - `revokeSession(sessionId)` - Invalidate specific session
    - `revokeAllSessions(userId, exceptCurrent?)` - Logout from all devices
    - Parse user agent for device/browser info
- [ ] Profile Page - Sessions Tab
  - [ ] Update `app/profile/page.tsx`
    - Add "Active Sessions" section
    - Show table/list of sessions:
      - Device/Browser (parsed from user agent)
      - IP Address (with geolocation if available)
      - Last Activity timestamp
      - "Current Session" badge
      - "Revoke" button per session
    - Add "Logout from All Devices" button
    - Show loading states during revocation
- [ ] Session Revocation API
  - [ ] Create `app/api/auth/sessions/route.ts`
    - GET: List user's active sessions
    - DELETE: Revoke all sessions (except current, optional)
  - [ ] Create `app/api/auth/sessions/[id]/route.ts`
    - DELETE: Revoke specific session
- [ ] Auto-Logout on Password Change
  - [ ] Update `app/api/auth/change-password/route.ts`
    - After successful password change, invalidate all sessions
    - Keep current session active (user stays logged in)
    - Show toast: "Password changed. All other sessions logged out."
- [ ] Security Alerts (Optional)
  - [ ] New login notification
    - Show toast on next visit: "New login from [Device] at [Time]"
    - Store in session metadata or separate table
    - "Was this you?" with "Yes" / "Secure my account" buttons
  - [ ] Suspicious activity detection (future)
    - Login from unusual location
    - Multiple failed login attempts
    - Session from different country

**Implementation Notes**:

- Use Better Auth's session table (`session` table already exists)
- `ipAddress` and `userAgent` fields already available in schema
- Parse user agent with `ua-parser-js` or similar library
- Consider IP geolocation API (optional, e.g., `ipapi.co`)

### 4.4 CSRF Protection & Security Review

**Priority**: Critical (Before Production)

**Goal**: Verify and implement CSRF protection across all state-changing endpoints.

- [ ] **CSRF Protection Verification**
  - [ ] Check if Better Auth automatically uses CSRF tokens
  - [ ] Test with Postman/curl: Try cross-origin state-changing requests
  - [ ] Verify `SameSite=Strict` or `SameSite=Lax` on session cookies
  - [ ] Test POST/PUT/DELETE endpoints without proper origin
  - [ ] Document findings in `docs/AUTH_SETUP.md`
  - [ ] If not enabled: Implement CSRF middleware in `proxy.ts`
- [ ] **Session Security**
  - [ ] Verify `httpOnly` flag on session cookies
  - [ ] Verify `secure` flag in production (HTTPS only)
  - [ ] Check session expiration and renewal logic
  - [ ] Test session fixation protection
- [ ] **Rate Limiting Verification** (Phase 4.1)
  - [ ] Verify all auth endpoints are rate-limited
  - [ ] Test brute-force protection on login
  - [ ] Monitor rate limit violations in production
- [ ] **SQL Injection Prevention**
  - [ ] Confirm all queries use Drizzle ORM (no raw SQL)
  - [ ] Review dynamic query construction
  - [ ] Test with SQL injection payloads
- [ ] **XSS Protection**
  - [ ] Verify React escapes user input by default
  - [ ] Check for dangerouslySetInnerHTML usage
  - [ ] Review markdown rendering (if any)
- [ ] **Input Validation**
  - [ ] All API endpoints validate input types
  - [ ] Email format validation
  - [ ] Password complexity requirements documented
  - [ ] Calendar name sanitization

### 4.5 Background Service Security

**Priority**: High

**Goal**: Ensure background sync service respects calendar ownership and permissions.

- [ ] **Orphaned Calendar Detection**
  - [ ] Update `lib/auto-sync-service.ts`
    - Check if calendar has owner before syncing
    - Skip sync for orphaned calendars (`ownerId = null`)
    - Log warning: "Sync skipped for calendar [id] - no owner"
- [ ] **Sync Failure Handling**
  - [ ] If owner deleted during sync: abort gracefully
  - [ ] If external sync deleted: clean up from sync queue
  - [ ] Retry logic for transient failures
- [ ] **Audit Logging** (Phase 4.2)
  - [ ] Log sync failures to audit log
  - [ ] Action: `"sync.failed"`
  - [ ] Metadata: `{ calendarId, reason: "no_owner" }`
- [ ] **Orphaned Sync Cleanup**
  - [ ] Mark external syncs as inactive when calendar loses owner
  - [ ] Reactivate if new owner assigned
  - [ ] Periodic cleanup job for orphaned syncs

---

## Phase 5: Calendar Sharing Features

### 5.1 Sharing API

**Audit Logging**: Integrate these events into the sharing API endpoints:

- [ ] **Calendar shared** - `app/api/calendars/[id]/shares/route.ts` POST
  - Action: `"calendar.shared"`
  - Metadata: `{ calendarName, sharedWith, permission }`
- [ ] **Calendar share removed** - `app/api/calendars/[id]/shares/[shareId]/route.ts` DELETE
  - Action: `"calendar.share.removed"`
  - Metadata: `{ calendarName, removedUser, removedBy: 'owner' | 'admin' | 'self' }`
- [ ] **Calendar permission changed** - `app/api/calendars/[id]/shares/[shareId]/route.ts` PUT

  - Action: `"calendar.permission.changed"`
  - Metadata: `{ calendarName, user, oldPermission, newPermission }`

- [ ] Create `app/api/calendars/[id]/shares/route.ts`
  - GET: List all shares for calendar (admin/owner only)
  - POST: Share calendar with user (admin/owner only) + log `"calendar.shared"` event
- [ ] Create `app/api/calendars/[id]/shares/[shareId]/route.ts`
  - PUT: Update share permission (admin/owner only) + log `"calendar.permission.changed"` event
  - DELETE: Remove share (admin/owner or self) + log `"calendar.share.removed"` event

### 5.2 User Search/Invite

- [ ] Create `app/api/users/search/route.ts`
  - Search users by email/name
  - Exclude already shared users
- [ ] Implement email invite system (optional)
  - Send invite link for new users
  - Auto-share calendar on registration

### 5.3 Sharing UI Components

- [ ] Create `components/calendar-share-sheet.tsx`
  - List current shares
  - User search/select
  - Permission dropdown (admin/write/read)
  - Add/remove shares
  - Show who shared the calendar
- [ ] Add "Share" button to calendar settings
- [ ] Create `components/shared-calendar-badge.tsx`
  - Show if calendar is shared with you
  - Show your permission level
  - Show owner name

### 5.4 Sharing Hooks

- [ ] Create `hooks/useCalendarShares.ts`
  - `fetchShares(calendarId)`
  - `addShare(calendarId, userId, permission)`
  - `updateShare(shareId, permission)`
  - `removeShare(shareId)`
- [ ] Update `useCalendars` hook
  - Include `isOwner`, `permission`, `sharedBy` fields
  - Filter out calendars with insufficient permissions

---

## Phase 6: Calendar Access Tokens (Easy Share Links)

**Goal**: Enable low-friction calendar sharing via simple links (like old password system, but secure).

### 6.1 Database Schema - Access Tokens

- [ ] Create `calendarAccessTokens` table in `lib/db/schema.ts`
  - `id` (text, primary key, UUID)
  - `calendarId` (text, references calendars, cascade delete)
  - `token` (text, unique, indexed) - Random secure token (32+ chars)
  - `name` (text, nullable) - Optional label (e.g., "Family Link", "Work Team")
  - `permission` (text: "read" | "write") - Access level for token holder
  - `expiresAt` (timestamp, nullable) - Optional expiration date
  - `createdBy` (text, references users) - Creator of token
  - `createdAt` (timestamp)
  - `lastUsedAt` (timestamp, nullable) - Track last access
  - `usageCount` (integer, default 0) - Track how often used
  - `isActive` (boolean, default true) - Can be disabled without deletion
- [ ] Add unique index on `token` column
- [ ] Add index on `(calendarId, isActive)` for quick lookups
- [ ] Generate migration: `npm run db:generate`

### 6.2 Token Middleware & Authentication

- [ ] Create `lib/auth/token-auth.ts`
  - `validateAccessToken(token: string)` - Check if token is valid & active
  - `getCalendarByToken(token: string)` - Get calendar + permission
  - `updateTokenUsage(tokenId: string)` - Update lastUsedAt & usageCount
  - `storeTokenInSession(token: string, calendarId: string)` - Persist access
- [ ] Update `proxy.ts` middleware
  - Check for `?token=xyz` in URL query parameters
  - Validate token before redirecting to calendar
  - Store validated token in secure cookie/session
  - Redirect to clean URL (remove token from URL)
- [ ] Update `lib/auth/permissions.ts`
  - Extend `getUserCalendarPermission()` to check session tokens
  - Token permissions apply alongside user permissions
  - Tokens grant access even if user not logged in

### 6.3 Token Management API

- [ ] Create `app/api/calendars/[id]/tokens/route.ts`
  - **GET**: List all tokens for calendar (owner/admin only)
    - Return: token (partial, e.g., "abc...xyz"), name, permission, expiresAt, lastUsedAt, usageCount
    - Never return full token (security)
  - **POST**: Create new access token (owner/admin only)
    - Body: `{ name?, permission, expiresAt? }`
    - Generate secure random token (crypto.randomBytes)
    - Return: Full token (only shown once!)
- [ ] Create `app/api/calendars/[id]/tokens/[tokenId]/route.ts`
  - **PATCH**: Update token (owner/admin only)
    - Update: name, permission, expiresAt, isActive
    - Cannot change token itself (security)
  - **DELETE**: Delete token (owner/admin only)
    - Revokes access immediately
    - Cascade cleanup of related data

### 6.4 Token UI Components

- [ ] Create `components/calendar-token-sheet.tsx`
  - List existing access tokens
  - Token preview (partial, e.g., "••••••xyz789")
  - Show metadata: name, permission, created date, last used, usage count
  - Toggle active/inactive status
  - Delete token with confirmation
  - Create new token dialog
- [ ] Create `components/calendar-token-create-dialog.tsx`
  - Input: Token name (optional, e.g., "Family Link")
  - Select: Permission level (read/write)
  - Date picker: Expiration date (optional)
  - Generate button → Show full token **once** with copy button
  - Warning: "Save this token now - it won't be shown again"
  - Generate shareable link: `${baseUrl}/calendar/${calendarId}?token=${token}`
- [ ] Create `components/calendar-token-badge.tsx`
  - Show "Accessed via Share Link" indicator
  - Display permission level (read-only/editable)
  - Show token name if available
- [ ] Add "Share Link" button to calendar settings
  - Opens token management sheet
  - Quick action: "Create Share Link" → Generates token → Shows link

### 6.5 Token Hooks

- [ ] Create `hooks/useCalendarTokens.ts`
  - `fetchTokens(calendarId)` - List tokens (owner/admin only)
  - `createToken(calendarId, name?, permission, expiresAt?)` - Generate new token
  - `updateToken(tokenId, updates)` - Modify token settings
  - `deleteToken(tokenId)` - Revoke token
  - `copyShareLink(token, calendarId)` - Copy full URL to clipboard

### 6.6 Token Access Flow

**User Journey:**

1. **Owner generates token:**

   - Click "Share" in calendar settings
   - Choose "Create Share Link"
   - Set permission (read/write) & optional expiration
   - Copy generated link: `https://app.example.com/calendar/abc?token=xyz`

2. **Recipient opens link:**

   - Middleware validates token
   - Token stored in secure session cookie
   - Redirect to clean URL: `https://app.example.com/calendar/abc`
   - User sees calendar with token-granted permissions
   - Banner: "You're viewing this calendar via share link (read-only)"

3. **Persistent access:**

   - Token stored in session (survives page reloads)
   - Works across multiple calendars (if multiple tokens)
   - Persists until: session expires, token revoked, or user clears cookies

4. **Token revocation:**
   - Owner disables/deletes token
   - All users with that token lose access immediately
   - Next request: "Access token invalid or revoked"

### 6.7 Security & Best Practices

**Critical Security Requirements**:

- [ ] **Token Generation**
  - [ ] Use `crypto.randomBytes(32)` for 256-bit security
  - [ ] Encode as URL-safe base64 or hex string
  - [ ] Verify randomness with test suite
- [ ] **Token Storage**
  - [ ] Store tokens hashed in database (SHA-256 or bcrypt)
  - [ ] Never log full tokens - only token IDs
  - [ ] Mask tokens in UI (show only last 6 characters)
  - [ ] Return full token only once on creation
- [ ] **Rate Limiting** (Phase 4.1)
  - [ ] Token validation endpoint: 10 requests per minute per IP
  - [ ] Token creation endpoint: 5 tokens per hour per user
  - [ ] Return `429 Too Many Requests` on limit exceeded
- [ ] **Audit Logging** (Phase 4.2)
  - [ ] Log token creation (action: `"token.create"`, metadata: `{ calendarId, permission }`)
  - [ ] Log token usage (action: `"token.use"`, metadata: `{ tokenId, calendarId }`)
  - [ ] Log token deletion (action: `"token.delete"`, metadata: `{ tokenId }`)
  - [ ] Track first-time token usage for owner notification
- [ ] **Token Lifecycle**
  - [ ] Show token usage statistics (last used, count)
  - [ ] Expire tokens automatically (cron job or on-access check)
  - [ ] Limit active tokens per calendar (e.g., max 10)
  - [ ] Warn owner when token is used for first time
- [ ] **Additional Security**
  - [ ] Optional: Require password confirmation to create tokens
  - [ ] Optional: IP whitelist for token access
  - [ ] Optional: Single-use tokens for extra sensitive calendars

### 6.8 Token vs Guest vs User Shares Comparison

| Feature         | Guest Access (3.4)  | Access Tokens (6)    | User Shares (5)    |
| --------------- | ------------------- | -------------------- | ------------------ |
| **Use Case**    | Public calendars    | Private link sharing | Team collaboration |
| **Setup**       | Set calendar public | Generate share link  | Invite by email    |
| **Recipient**   | No account needed   | No account needed    | Account required   |
| **Revocation**  | Disable guest mode  | Delete token         | Remove share       |
| **Granularity** | Per calendar        | Per link/token       | Per user           |
| **Audit Trail** | None                | Token usage stats    | User activity log  |
| **Persistence** | Always accessible   | Until revoked        | Until removed      |
| **Example**     | Public team shifts  | Share with family    | Work calendar      |

---

## Phase 7: Data Migration

### 7.1 Migration Script

- [ ] Create `lib/migrate-to-auth.ts` script
- [ ] Generate default admin user for existing data
  - Email: `admin@localhost`
  - Set password or force password reset
- [ ] Assign all existing calendars to admin user
- [ ] Mark all calendars as owned (no shares initially)

### 7.2 Migration Execution

- [ ] Backup database before migration
- [ ] Generate Drizzle migration files
  ```bash
  npx drizzle-kit generate
  ```
- [ ] Apply migrations to database
  ```bash
  npx drizzle-kit migrate
  ```
- [ ] Run data migration script
  ```bash
  node lib/migrate-to-auth.js
  ```
- [ ] Verify all calendars have owners
- [ ] Test auth system with test user

### 7.3 Backwards Compatibility

- [ ] If `AUTH_ENABLED=false`:
  - Skip authentication checks
  - Show all calendars to everyone
  - Hide user-related UI
  - Use "single-user mode" behavior
- [ ] Add migration guide to README

### 7.4 Runtime Auth Toggle Handling

**Scenario**: User creates calendars with `AUTH_ENABLED=false` (ownerId=null), then enables auth later.

**Priority**: Medium (Important for self-hosted instances)

**Goal**: Automatically handle orphaned calendars when auth is enabled at runtime.

- [ ] **Admin Panel Detection & Management** (Main Solution)

  - [ ] When admin logs in first time after enabling auth:
    - Detect orphaned calendars (ownerId=null)
    - Show warning banner: "X calendars need owner assignment"
    - Link to orphaned calendar management page
  - [ ] Admin panel shows list of orphaned calendars (Phase 9.3)
    - Manual assignment to users
    - Bulk assignment to admin user
    - Delete option for unwanted calendars
  - [ ] See Phase 9.3 for detailed implementation

- [ ] **API Protection for Orphaned Calendars**

  - [ ] Update calendar API routes to handle orphaned calendars:
    - If `AUTH_ENABLED=true` AND `ownerId=null`:
      - GET: Allow read-only access (backwards compatibility)
      - PUT/DELETE: Require admin permission
      - POST shifts/presets: Block with clear error message
    - Return warning header: `X-Calendar-Orphaned: true`
  - [ ] Show UI warning on orphaned calendars:
    - "This calendar has no owner. Contact admin to assign ownership."
    - Disable edit actions until owner assigned

- [ ] **Documentation**
  - [ ] Add to README.md:
    - Section: "Enabling Auth on Existing Instance"
    - Steps: 1) Enable AUTH_ENABLED, 2) Create admin user, 3) Assign orphaned calendars
    - Warning: Orphaned calendars are read-only until assigned
  - [ ] Add to `.env.example`:
    - Comment: "Note: Calendars created before enabling auth will need owner assignment"
  - [ ] Create migration guide: `docs/MIGRATION_AUTH_TOGGLE.md`
    - Detailed step-by-step process
    - Screenshots of admin panel
    - Troubleshooting section

**Implementation Notes**:

- No automatic assignment at startup (avoid surprises)
- Admin has full control over assignment process
- Backwards compatibility: orphaned calendars remain readable
- Admin panel provides clear overview and bulk actions

---

## Phase 8: UI/UX Enhancements

### 8.1 Permission UI Indicators & Calendar List Updates

**Priority**: Important (Before Production, Low Priority Currently)

**Goal**: Show users their permission level and disable actions they cannot perform.

- [ ] **Calendar Selector Enhancements**
  - [ ] Update `components/calendar-selector.tsx`
    - Show permission badge next to calendar name:
      - "Owner" (blue badge)
      - "Shared - Admin" (green badge)
      - "Shared - Edit" (yellow badge)
      - "Shared - Read-only" (gray badge)
    - Add owner name tooltip: "Owned by [Name]" for shared calendars
    - Disable/hide buttons based on permissions:
      - Settings button: Only admin/owner
      - Delete: Hidden for non-owners
      - External Sync: Only write permission or higher
    - Group calendars in dropdown:
      - Section 1: "My Calendars"
      - Section 2: "Shared with me"
- [ ] **Client-Side Permission Hook**
  - [ ] Create `hooks/useCalendarPermission.ts`
    - `useCalendarPermission(calendarId)` → returns permission level
    - Fetch permission from server on mount
    - Cache result in React state
    - Provide helper functions:
      - `canView()`, `canEdit()`, `canManage()`, `canDelete()`
- [ ] **Button Visibility Control**
  - [ ] Update `components/calendar-settings-sheet.tsx`
    - Disable "Delete Calendar" button if not owner
    - Show "You don't have permission" message
    - Hide password/lock settings if not admin
  - [ ] Update `components/shift-sheet.tsx`
    - Set form to read-only mode if permission < write
    - Disable save/delete buttons
    - Show banner: "Read-only access - You cannot edit shifts"
  - [ ] Update `components/preset-manage-sheet.tsx`
    - Disable preset editing if permission < write
    - Hide "Add Preset" button
    - Show read-only indicator
  - [ ] Update `components/note-sheet.tsx`
    - Same read-only logic as shifts
    - Disable form inputs if permission < write
- [ ] **Read-Only Banners**
  - [ ] Create `components/read-only-banner.tsx`
    - Reusable component for permission warnings
    - Shows: "You have [permission] access to this calendar"
    - Icon and color based on permission level
  - [ ] Add to main calendar view (above grid)
  - [ ] Add to sheets/dialogs where relevant
- [ ] **Permission Badges Component**
  - [ ] Create `components/ui/permission-badge.tsx`
    - Reusable badge component
    - Props: `permission`, `ownerId`, `ownerName`
    - Variants: owner, admin, write, read
    - Tooltip with detailed explanation
- [ ] **Tooltips & Help Text**
  - [ ] Add permission explanations to UI
    - "Admin: Can manage settings and shares"
    - "Edit: Can create and edit shifts"
    - "Read-only: Can view calendar only"
  - [ ] Add to calendar selector dropdown
  - [ ] Add to share dialog (Phase 5.3)

### 8.2 Permission-Based UI Actions

- [ ] Hide "Delete" button if not owner
- [ ] Disable "Settings" button if not admin
- [ ] Show read-only banner on shared calendars
- [ ] Disable shift editing if permission < write

### 8.3 Notifications & Feedback

- [ ] Show toast when calendar is shared with you
- [ ] Notify owner when someone accepts share
- [ ] Email notifications (optional)

### 8.4 Mobile Optimization

- [ ] Responsive share dialog
- [ ] Touch-friendly permission selector
- [ ] Mobile user search

### 8.5 Loading States & Skeleton Optimization

**Priority**: Medium (Polish & User Experience)

**Goal**: Implement consistent, non-intrusive loading feedback across the app to prevent UI flicker and improve perceived performance.

**Current Problems:**

1. **Skeleton Flicker**: Skeletons appear for very short durations (0.5s or less), causing visual noise
2. **Double Loading Feedback**: Some components (e.g., `calendar-grid.tsx`) show skeleton → then loading spinner
3. **Router-Induced Re-renders**: Navigation chain `/ → /?id=XXX` triggers multiple skeleton renders
4. **Inconsistent Patterns**: Different components use different loading strategies

**Affected Components:**

- `app/page.tsx` - Main calendar page (initial load)
- `app/profile/page.tsx` - Profile page
- `components/preset-list.tsx` - Preset selector
- `components/calendar-grid.tsx` - Calendar grid with shifts
- All components except header/footer

#### 8.5.1 Implement Delayed Skeleton Pattern

**Strategy**: Use a **Delayed Skeleton Pattern with Minimum Display Time** to prevent flicker while maintaining loading feedback.

- [ ] **Create `useDelayedLoading` Hook**

  - [ ] Create `hooks/useDelayedLoading.ts`
    ```typescript
    /**
     * Hook to delay skeleton display and enforce minimum display time
     *
     * @param isLoading - Actual loading state from data hook
     * @param delayMs - Delay before showing skeleton (default: 200ms)
     * @param minDisplayMs - Minimum time to show skeleton once visible (default: 400ms)
     * @returns shouldShowSkeleton - Boolean indicating if skeleton should render
     *
     * Behavior:
     * - If loading completes < delayMs: No skeleton shown
     * - If loading completes > delayMs: Skeleton shown for at least minDisplayMs
     * - Prevents rapid flicker for fast loads
     * - Ensures smooth transitions for slow loads
     */
    ```
  - [ ] Parameters:
    - `delayMs`: 200-300ms (don't show skeleton for very fast loads)
    - `minDisplayMs`: 400ms (if skeleton shown, display long enough to read)
  - [ ] Return: `shouldShowSkeleton` boolean
  - [ ] Internal logic: Track timestamps, use `useEffect` + `setTimeout`

- [ ] **Create Loading Configuration**

  - [ ] Create `lib/loading-config.ts`

    ```typescript
    export const LOADING_THRESHOLDS = {
      // Don't show skeleton for loads < 200ms (instant feel)
      DELAY_THRESHOLD: 200,

      // Show skeleton for minimum 400ms (smooth transition)
      MIN_DISPLAY_TIME: 400,

      // Component-specific overrides
      PROFILE_PAGE: { DELAY: 300, MIN_DISPLAY: 500 },
      CALENDAR_GRID: { DELAY: 150, MIN_DISPLAY: 400 },
      PRESET_LIST: { DELAY: 250, MIN_DISPLAY: 300 },
    } as const;
    ```

#### 8.5.2 Update Components to Use Delayed Loading

- [ ] **Update `app/page.tsx`**
  - [ ] Replace `loading` with `useDelayedLoading(loading)`
  - [ ] Remove redundant loading checks
  - [ ] Ensure only ONE skeleton per section (no skeleton + spinner combos)
- [ ] **Update `app/profile/page.tsx`**
  - [ ] Use `useDelayedLoading(isLoading || accountsLoading)`
  - [ ] Remove skeleton if data loads < delay threshold
- [ ] **Update `components/preset-list.tsx`**
  - [ ] Replace `if (loading) return <PresetListSkeleton />` pattern
  - [ ] Use `useDelayedLoading(loading)` hook
- [ ] **Update `components/calendar-content.tsx`**

  - [ ] Remove duplicate loading spinners if skeleton already shown
  - [ ] Ensure calendar-grid.tsx doesn't show skeleton + spinner

- [ ] **Update All Other Components with Skeletons**
  - [ ] Search for all `*Skeleton` component usages
  - [ ] Apply delayed loading pattern consistently
  - [ ] Document exceptions (e.g., footer/header never show skeletons)

#### 8.5.3 Optimistic UI for User Actions

**Goal**: Implement instant feedback for user interactions (no loading states).

- [ ] **Already Implemented** (verify consistency):

  - ✅ Shift creation - Optimistic update with temp ID
  - ✅ Shift deletion - Immediate removal from UI
  - ✅ Preset selection - Instant state change
  - ✅ Calendar switching - Immediate UI update

- [ ] **Verify No Regressions**:
  - [ ] Test shift creation shows immediately
  - [ ] Test calendar switching feels instant
  - [ ] Test preset selection has no delay
  - [ ] No loading spinners on button clicks (use disabled state instead)

#### 8.5.4 Router Navigation Optimization

**Goal**: Prevent double-skeleton from router redirect chain.

- [ ] **Investigate Router Behavior**

  - [ ] Check why `/ → /?id=XXX` causes double render
  - [ ] Consider using `router.replace` instead of `router.push` for initial redirect
  - [ ] Test if pre-populating `?id` in URL prevents re-render

- [ ] **Potential Solutions**:
  - [ ] Option A: Pre-load calendar ID before first render (SSR/server component)
  - [ ] Option B: Use `useTransition` to defer skeleton until after router settle
  - [ ] Option C: Cache calendar selection in localStorage/cookie
  - [ ] Test each approach and implement best solution

#### 8.5.5 Loading Feedback Patterns (Style Guide)

**Goal**: Standardize when to use which loading pattern across the app.

- [ ] **Create Loading Pattern Documentation** (in code comments or README)

  ```markdown
  ## Loading Feedback Patterns

  ### 1. Delayed Skeletons (Initial Page Load)

  - **Use for**: Page-level data fetching, large component trees
  - **Examples**: Calendar page, Profile page, Compare view
  - **Pattern**: `useDelayedLoading()` hook with skeleton components

  ### 2. Optimistic UI (User Actions)

  - **Use for**: Create/Update/Delete operations triggered by user
  - **Examples**: Shift creation, Preset selection, Note editing
  - **Pattern**: Update UI immediately, revert on error

  ### 3. Inline Spinners (Button Actions)

  - **Use for**: Long-running server operations in forms
  - **Examples**: "Save" button, "Export" button, "Sync" button
  - **Pattern**: Button disabled + spinner icon + "Saving..." text

  ### 4. No Loading Feedback (Instant Actions)

  - **Use for**: Pure client-side state changes
  - **Examples**: Theme toggle, Language switch, View settings
  - **Pattern**: Immediate state change, no loading indicator

  ### 5. Progress Indicators (Long Operations)

  - **Use for**: Multi-step processes, file uploads, sync operations
  - **Examples**: Calendar export (PDF), External sync, Bulk operations
  - **Pattern**: Progress bar or percentage with cancel option
  ```

- [ ] **Apply Patterns Consistently**:
  - [ ] Audit all loading states in codebase
  - [ ] Categorize by pattern type
  - [ ] Refactor to use correct pattern
  - [ ] Remove any skeleton + spinner combos

#### 8.5.6 Testing & Validation

- [ ] **Test Slow Network Conditions**

  - [ ] Enable Chrome DevTools network throttling (Slow 3G)
  - [ ] Verify skeletons appear after delay threshold
  - [ ] Verify skeletons stay visible for minimum time
  - [ ] Confirm smooth transition to real content

- [ ] **Test Fast Network Conditions**

  - [ ] Disable throttling (fast connection)
  - [ ] Verify NO skeleton flicker for instant loads
  - [ ] Confirm page feels responsive and fast

- [ ] **Test Edge Cases**

  - [ ] Rapid route switching (click calendar A → B → C quickly)
  - [ ] Browser back/forward navigation
  - [ ] Refresh during loading
  - [ ] Offline → online transition

- [ ] **Performance Metrics**
  - [ ] Measure time to first meaningful paint
  - [ ] Track skeleton display frequency (should be rare for fast users)
  - [ ] Monitor user feedback on loading experience

**Implementation Priority**: Medium (after auth migration stable, before production)

**Estimated Effort**: 2-3 days

**Dependencies**: None (can implement independently)

---

## Phase 9: Admin Panel & Super Admin Features

### 9.1 Super Admin Concept

- [ ] Add `isSuperAdmin` flag to `user` table (boolean, default: false)
- [ ] Migration: Mark first created user as super admin (`ORDER BY createdAt LIMIT 1`)
- [ ] Add helper function `isSuperAdmin(userId)` in `lib/auth/permissions.ts`
- [ ] Super admin bypasses all permission checks (full access to everything)

### 9.2 Admin Panel - User Management

- [ ] Create `app/admin/page.tsx` (protected route, super admin only)
- [ ] Create `app/api/admin/users/route.ts`
  - GET: List all users with details (email, name, createdAt, calendars count)
  - POST: Create new user (super admin can create users)
- [ ] Create `app/api/admin/users/[id]/route.ts`
  - GET: Get user details
  - PUT: Update user info (name, email, password)
  - DELETE: Delete user and handle orphaned calendars
- [ ] Create `app/api/admin/users/[id]/password/route.ts`
  - PUT: Change user password (super admin can reset any password)
- [ ] Admin UI Components:
  - [ ] `components/admin/user-list.tsx` - Table of all users
  - [ ] `components/admin/user-edit-dialog.tsx` - Edit user details
  - [ ] `components/admin/user-password-dialog.tsx` - Reset user password
  - [ ] `components/admin/user-stats.tsx` - User statistics overview

### 9.3 Admin Panel - Calendar Management

- [ ] Create `app/api/admin/calendars/route.ts`
  - GET: List all calendars with owner info
  - PUT: Bulk operations (transfer ownership, delete multiple)
- [ ] Create `app/api/admin/calendars/[id]/route.ts`
  - GET: Get calendar details with full stats
  - PUT: Update calendar (rename, change owner, change settings)
  - DELETE: Delete calendar (force delete even with shares)
- [ ] Create `app/api/admin/calendars/[id]/transfer/route.ts`
  - POST: Transfer calendar ownership to another user
- [ ] **Orphaned Calendar Management (Phase 7.4 Implementation)**
  - [ ] Create `app/api/admin/calendars/orphaned/route.ts`
    - GET: List all orphaned calendars (ownerId=null)
    - PUT: Bulk assign orphaned calendars to specific user
    - DELETE: Bulk delete orphaned calendars
  - [ ] Create `app/api/admin/calendars/orphaned/[id]/assign/route.ts`
    - POST: Assign single orphaned calendar to user
    - Body: `{ userId: string }` or `{ assignToSelf: true }`
  - [ ] Create `components/admin/orphaned-calendar-banner.tsx`
    - Show warning banner on admin dashboard when orphaned calendars exist
    - Text: "⚠️ X calendars have no owner and need assignment"
    - Button: "Manage Orphaned Calendars"
    - Only show when orphaned calendars exist
  - [ ] Create `components/admin/orphaned-calendar-list.tsx`
    - Dedicated page/sheet for orphaned calendar management
    - Table columns:
      - Calendar name
      - Created date
      - Shift count
      - Last activity date
      - Actions: Assign to user / Delete
    - Bulk actions:
      - "Assign All to Me" button
      - "Assign All to User" with user selector
      - "Delete All" with confirmation
    - Search/filter orphaned calendars
  - [ ] Create `components/admin/assign-calendar-dialog.tsx`
    - User search/select dropdown
    - "Assign to myself" shortcut button
    - Show calendar preview before assignment
    - Confirmation: "Assign [Calendar] to [User]?"
  - [ ] Update `app/admin/page.tsx` (admin dashboard)
    - Show orphaned calendar count in stats widget
    - Display `OrphanedCalendarBanner` at top if orphaned exist
    - Add "Orphaned Calendars" quick link
  - [ ] Create `app/admin/calendars/orphaned/page.tsx`
    - Dedicated page for orphaned calendar management
    - Full-screen table with all orphaned calendars
    - Bulk selection and actions
    - Export orphaned calendar list as CSV
- [ ] Admin UI Components:
  - [ ] `components/admin/calendar-list.tsx` - Table of all calendars
  - [ ] `components/admin/calendar-edit-dialog.tsx` - Edit calendar
  - [ ] `components/admin/calendar-transfer-dialog.tsx` - Transfer ownership
  - [ ] `components/admin/calendar-stats.tsx` - Calendar statistics

### 9.4 Admin Panel - Audit Logs

**Admin Action Logging**: Integrate these events into admin panel endpoints:

- [ ] **User deletion** - Admin user management DELETE
  - Action: `"admin.user.delete"`
  - Metadata: `{ deletedUser, calendarsTransferred: number }`
- [ ] **Calendar transfer** - Admin calendar transfer POST
  - Action: `"admin.calendar.transfer"`
  - Metadata: `{ calendarName, fromUser, toUser }`
- [ ] **Password reset** - Admin password reset PUT

  - Action: `"admin.user.password_reset"`
  - Metadata: `{ targetUser }`

- [ ] Create `app/admin/logs/page.tsx` - View ALL audit logs (admin only)
  - Same table layout as user activity page
  - Additional columns: User (email/name), User ID
  - Filters: action type, user, resource type, severity, date range
  - Search: by action, userId, resourceId, IP address, email
  - Show both `isUserVisible = true` AND `isUserVisible = false` logs
  - Pagination for large datasets (100+ rows per page)
  - Export logs as CSV/JSON
- [ ] Manual log deletion (admin only)
  - Bulk delete by date range or action type
  - No automatic deletion (retention managed manually)
  - Confirm dialog with impact preview ("X logs will be deleted")
  - Option to delete specific log entries
- [ ] Admin Navigation
  - Add "Audit Logs" to admin sidebar/menu
  - Show admin badge with critical event count

### 9.5 Admin Panel - System Overview

- [ ] Create `app/api/admin/stats/route.ts`
  - GET: System-wide statistics (users, calendars, shifts, shares)
- [ ] Create `components/admin/system-stats.tsx`
  - Total users count
  - Total calendars count
  - Total shifts count
  - Storage usage (database size)
  - Active sessions count
  - Recent activity log

### 9.5 Admin Panel - Access Control

- [ ] Add admin-only middleware check in `proxy.ts`
  - Block `/admin` routes for non-super-admin users
- [ ] Add "Admin Panel" link in user menu (visible only to super admin)
- [ ] Create `hooks/useAdminAccess.ts`
  - `isSuperAdmin` check
  - Redirect non-admins to homepage

### 9.6 Admin Panel UI/UX

- [ ] Admin panel layout: `app/admin/layout.tsx`
  - Sidebar navigation (Users, Calendars, Stats, Logs)
  - Breadcrumbs
  - Admin badge/indicator
- [ ] Admin dashboard: `app/admin/page.tsx`
  - System overview cards
  - Quick actions
  - Recent activity
- [ ] Admin users page: `app/admin/users/page.tsx`
  - Searchable user list
  - Filter by registration date
  - Bulk actions (delete, export)
- [ ] Admin calendars page: `app/admin/calendars/page.tsx`
  - Searchable calendar list
  - Filter by owner
  - Bulk actions (transfer, delete)
- [ ] Admin logs page: `app/admin/logs/page.tsx`
  - Filterable audit log
  - Export logs functionality

**Security Considerations**:

- Super admin actions bypass normal permissions
- All admin actions must be logged for audit trail
- Super admin flag cannot be changed via UI (only database)
- Rate limiting applies to admin routes
- Admin panel requires active session (no API key access)

---

## Phase 10: Testing & Documentation

### 10.1 Documentation

- [ ] Update README.md
  - Auth system overview
  - Admin panel features
  - Environment variables
  - OIDC configuration guide
  - Migration instructions
- [ ] Create `docs/AUTH_SETUP.md`
  - Step-by-step setup guide
  - OIDC provider configuration (Google, GitHub, Discord)
  - Custom OIDC provider setup (Keycloak, Authentik, etc.)
  - Self-hosting considerations
- [ ] Update Docker setup for auth

### 10.2 Integration Testing

- [ ] Test complete auth flow (register, login, logout)
- [ ] Test permission system with multiple users
- [ ] Test calendar sharing workflows
- [ ] Test access token functionality
- [ ] Test data migration script
- [ ] Test backwards compatibility (AUTH_ENABLED=false)
- [ ] Performance testing with realistic data
- [ ] Cross-browser compatibility testing

---

## Phase 11: Performance & Polish

### 11.1 Performance Optimization & Permission Caching

**Priority**: Medium (Post-MVP)

- [ ] **Database Indexes**
  - [ ] Index `ownerId` column in calendars
  - [ ] Index `(calendarId, userId)` in shares
  - [ ] Verify indexes with `EXPLAIN QUERY PLAN` (SQLite)
- [ ] **Permission Caching**
  - [ ] Update `lib/auth/permissions.ts`
    - Add in-memory Map-based cache
    - Cache key: `${userId}:${calendarId}`
    - Cache value: `{ permission: string, expires: timestamp }`
    - TTL: 60 seconds (configurable)
  - [ ] Create `getCachedPermission(userId, calendarId)` function
    - Check cache first, return if valid
    - On cache miss: query DB, store in cache
    - Return cached permission
  - [ ] Cache Invalidation Strategy
    - Manual invalidation on permission changes:
      - Calendar ownership transfer
      - Share creation/update/deletion
      - Calendar deletion
    - Emit SSE event: `permission.changed` with `{ userId, calendarId }`
    - Clients refetch permissions on event
  - [ ] Add cache statistics (optional)
    - Track hit rate, miss rate
    - Log to console in development
    - Expose as admin metric (Phase 7)
- [ ] **Performance Benchmarking**
  - [ ] Measure permission check latency before caching
  - [ ] Measure after caching implementation
  - [ ] Target: < 5ms average permission check
  - [ ] Document results in `docs/PERFORMANCE.md`
- [ ] **Query Optimization**
  - [ ] Review slow queries with SQLite profiling
  - [ ] Optimize calendar list query (with permissions)
  - [ ] Batch permission checks where possible
  - [ ] Consider prepared statements for hot paths

### 11.2 SSE Updates

- [ ] Emit share events via SSE
- [ ] Real-time calendar share notifications
- [ ] Update `instrumentation.ts` for multi-user

### 11.3 Edge Cases

- [ ] **Orphaned Calendars**
  - [ ] Handle calendars with `ownerId = null` (after user deletion)
  - [ ] Migration script assigns to admin (Phase 7.1 - one-time migration)
  - [ ] Runtime auth toggle handling (Phase 7.4 - ongoing management)
  - [ ] Admin panel shows orphaned calendars (Phase 9.3 - detailed implementation)
  - [ ] Prevent creation of calendars without owner (when auth enabled)
  - [ ] Note: See Phase 7.4 for AUTH_ENABLED toggle scenario
- [ ] **Deleted Users**
  - [ ] Verify cascade cleanup of:
    - Sessions
    - Calendar shares
    - Audit logs (set userId to null)
  - [ ] Handle calendar ownership: `SET NULL` (becomes orphaned)
  - [ ] Test deletion flow end-to-end
- [ ] **Calendar Transfer**
  - [ ] Handle owner change (future feature)
  - [ ] Update all related shares
  - [ ] Notify old and new owner
  - [ ] Transfer external sync ownership
- [ ] **Permission Conflicts**
  - [ ] User has multiple shares for same calendar (shouldn't happen)
  - [ ] Resolution: Take highest permission level
  - [ ] Add unique constraint to prevent duplicates (already done in 1.4)

---

## Environment Variables

**Note**: Currently requires duplicated variables (server + NEXT*PUBLIC* for client). Phase 2.1 will evaluate if deduplication is possible.

```env
# Auth System
NEXT_PUBLIC_AUTH_ENABLED=true|false        # Enable/disable entire auth system
BETTER_AUTH_SECRET=<random-secret>         # Session encryption key (use: npx @better-auth/cli secret)
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000  # Base URL for auth
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000  # Comma-separated (server-side only)

# User Registration Settings
NEXT_PUBLIC_ALLOW_USER_REGISTRATION=true|false    # Enable/disable new user signups (default: true)

# Session Settings (server-side only)
SESSION_MAX_AGE=604800                     # 7 days (in seconds)
SESSION_UPDATE_AGE=86400                   # 1 day (in seconds)

# Google OAuth (optional)
GOOGLE_CLIENT_ID=                          # Server-side (required for auth)
GOOGLE_CLIENT_SECRET=                      # Server-side (required for auth)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=              # Client-side (required for UI detection)

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=                          # Server-side (required for auth)
GITHUB_CLIENT_SECRET=                      # Server-side (required for auth)
NEXT_PUBLIC_GITHUB_CLIENT_ID=              # Client-side (required for UI detection)

# Discord OAuth (optional)
DISCORD_CLIENT_ID=                         # Server-side (required for auth)
DISCORD_CLIENT_SECRET=                     # Server-side (required for auth)
NEXT_PUBLIC_DISCORD_CLIENT_ID=             # Client-side (required for UI detection)

# Custom OIDC Provider (optional)
CUSTOM_OIDC_ENABLED=false                  # Server-side (required for auth)
CUSTOM_OIDC_NAME="Custom SSO"              # Display name for login button
CUSTOM_OIDC_ISSUER=https://sso.example.com/.well-known/openid-configuration  # Discovery URL
CUSTOM_OIDC_CLIENT_ID=                     # Server-side (required for auth)
CUSTOM_OIDC_CLIENT_SECRET=                 # Server-side (required for auth)
CUSTOM_OIDC_SCOPES=openid profile email    # Space separated

# Client-side (required for UI detection)
NEXT_PUBLIC_CUSTOM_OIDC_ENABLED=false
NEXT_PUBLIC_CUSTOM_OIDC_CLIENT_ID=
NEXT_PUBLIC_CUSTOM_OIDC_NAME="Custom SSO"

# Guest Access Settings (Phase 3.4)
NEXT_PUBLIC_ALLOW_GUEST_ACCESS=false      # Allow viewing calendars without login (default: false)
```

---

## Risk Assessment & Mitigation

### High Risk

- **Data Migration Failure**: Mitigation → Backup before migration, rollback plan
- **Breaking Existing Instances**: Mitigation → Auth disabled by default, gradual rollout

### Medium Risk

- **Permission Logic Bugs**: Mitigation → Comprehensive testing, security review
- **OIDC Configuration Complexity**: Mitigation → Detailed documentation, examples

### Low Risk

- **Performance Degradation**: Mitigation → Database indexes, query optimization
- **UI Confusion**: Mitigation → Clear permission indicators, tooltips

---

## Success Criteria

- [ ] Auth can be fully disabled (single-user mode works)
- [ ] Auth can be enabled with username/password
- [ ] At least 2 OIDC providers working (Google + GitHub)
- [ ] Custom OIDC provider configuration works (tested with Keycloak)
- [ ] Calendar sharing works with all permission levels
- [ ] Existing data migrates successfully
- [ ] No breaking changes for existing users (when auth disabled)
- [ ] All API routes properly protected
- [ ] Documentation complete and clear
- [ ] Security review passed
- [ ] Performance impact < 10% with auth enabled

---

## Notes & Decisions

- **Better Auth chosen** over NextAuth.js for better TypeScript support
- **Drizzle adapter** built into Better Auth core (no separate package needed)
- **Generic OAuth plugin** required for custom OIDC providers (not built-in)
- **CLI auto-generates** schema + relations for Drizzle (use `npx @better-auth/cli generate`)
- **Old password system will be removed** completely (no hybrid approach)
- **Auth disabled by default** to ensure backwards compatibility
- **Orphaned calendars** (no owner) will be handled in migration script
- **Permission hierarchy**: Owner > Admin > Write > Read
- **Calendar transfer** feature postponed to post-MVP
- **Email invites** optional feature for Phase 4
- **Environment variables** use `BETTER_AUTH_` prefix (not `AUTH_`)
- **Discovery URL** for custom OIDC should include `/.well-known/openid-configuration`
- **Experimental joins** optional but recommended for 2-3x performance boost
