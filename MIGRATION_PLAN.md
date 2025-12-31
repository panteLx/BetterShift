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

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

**Audit Logging**:

- [x] **Sessions revoked** - Session management API

  - Action: `"auth.session.revoked"`
  - Metadata: `{ revokedBy: 'user' | 'password_change' | 'admin', count: number }`
  - Integrated into session revocation (bulk revocation only)

- [x] Better Auth Integration
  - [x] Migrated from custom API routes to Better Auth client methods
    - Uses `authClient.listSessions()` to fetch active sessions
    - Uses `authClient.revokeOtherSessions()` to logout from all other devices
    - Session ID comparison via cookie (`better-auth.session_token`)
  - [x] Updated `lib/auth/sessions.ts`
    - `getUserSessions(userId, currentSessionId?)` - Server-side session listing with device info parsing
    - `revokeAllSessions(userId, exceptCurrent?)` - Server-side bulk revocation for API routes
    - Removed `revokeSession(sessionId)` and `getSessionUserId()` - no longer needed
    - Parse user agent with `ua-parser-js` (browser, OS, device type)
    - Device icons: Desktop/Mobile/Tablet/Unknown
- [x] Profile Page - Sessions Section
  - [x] Updated `app/profile/page.tsx`
    - Added "Active Sessions" card between "Connected Accounts" and "Danger Zone"
    - Card-list design (prettier than table, mobile-optimized)
    - Shows for each session:
      - Device icon (Desktop/Mobile/Tablet)
      - Device name parsed with UAParser (e.g., "Chrome 120 on Windows 10")
      - Browser + OS details
      - IP address
      - Last active timestamp (formatted with Intl.DateTimeFormat)
      - "Current Device" badge (blue, primary color)
    - "Logout from All Devices" button in card header (only shown if >1 session)
    - Uses `authClient.revokeOtherSessions()` - prevents accidental self-revocation
    - Loading states during fetch
    - Empty state if no sessions
    - Current session highlighted with primary border + badge
    - **No individual session revocation** - only bulk "revoke all other sessions" to prevent users from accidentally logging themselves out
- [x] Session Revocation API (Simplified)
  - [x] Updated `app/api/auth/sessions/route.ts`
    - GET: List user's active sessions with parsed device info (uses Better Auth `auth.api.getSession()`)
    - DELETE: Revoke all sessions except current (uses Better Auth bulk revocation)
  - [x] **Removed** `app/api/auth/sessions/[id]/route.ts`
    - No longer needed - individual session revocation removed
    - Better Auth client handles session management directly
- [x] Auto-Logout on Password Change
  - [x] Updated `app/api/auth/change-password/route.ts`
    - After successful password change, invalidate all sessions except current
    - Current session stays active (user remains logged in)
    - Returns `sessionsRevoked` count in response
    - Audit log event with `revokedBy: "password_change"` + session count
- [x] Session Hook
  - [x] Updated `hooks/useSessions.ts`
    - Uses Better Auth client methods internally
    - `sessions` - Array of SessionWithDevice objects from Better Auth
    - `isLoading` - Loading state
    - `error` - Error message
    - `refetch()` - Reload sessions
    - `revokeAllSessions()` - Revoke all except current using `authClient.revokeOtherSessions()`
    - **Removed** `revokeSession(id)` - individual session revocation no longer supported
- [x] Translations
  - [x] English (`messages/en.json`)
  - [x] German (`messages/de.json`)
  - [x] Italian (`messages/it.json`)
  - Added keys:
    - `auth.activeSessions` - "Active Sessions"
    - `auth.activeSessionsDescription` - Description text
    - `auth.noActiveSessions` - Empty state
    - `auth.browser` - "Browser"
    - `auth.operatingSystem` - "OS"
    - `auth.ipAddress` - "IP Address"
    - `auth.lastActive` - "Last active"
    - `auth.logoutAllDevices` - Bulk revoke button
    - `auth.sessionsRevokedCount` - Success toast with count
  - **Removed** keys (no longer used):
    - `auth.revokeSession` - Individual session revocation removed
    - `auth.sessionRevoked` - Individual revocation toast removed

**Implementation Notes**:

- Uses Better Auth's built-in session management (`authClient.listSessions()`, `authClient.revokeOtherSessions()`)
- User agent parsed with `ua-parser-js` on client-side (~60KB library, already in project)
- Device type detection: mobile, tablet, desktop, unknown
- Session identification: Compares session token from Better Auth with cookie value
- Card-list design for better mobile UX vs table layout
- Current session protection: Only "revoke all other sessions" available (no individual revocation to prevent self-logout)
- All sessions revoked on password change (except current) for security
- Audit logging: Bulk revocation logged with appropriate metadata
- No IP geolocation (KISS principle)
- No custom session names (future enhancement if needed)
- **Simplified architecture**: Removed custom session revocation logic, relies entirely on Better Auth client methods

### 4.4 CSRF Protection & Security Review

**Priority**: Critical (Before Production)

**Goal**: Verify and implement CSRF protection across all state-changing endpoints.

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

- [x] **CSRF Protection Verification**
  - [x] Check if Better Auth automatically uses CSRF tokens → **YES** (origin validation, SameSite cookies, Fetch Metadata)
  - [x] Test with Postman/curl: Try cross-origin state-changing requests → See [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) Section 1
  - [x] Verify `SameSite=Strict` or `SameSite=Lax` on session cookies → **Lax** (configured in `lib/auth.ts`)
  - [x] Test POST/PUT/DELETE endpoints without proper origin → Blocked by Better Auth origin validation
  - [x] If not enabled: Implement CSRF middleware in `proxy.ts` → **Not needed** (Better Auth handles it) + Added security headers
- [x] **Session Security**
  - [x] Verify `httpOnly` flag on session cookies → **YES** (Better Auth default + explicit config)
  - [x] Verify `secure` flag in production (HTTPS only) → **YES** (auto-enabled for `https://` URLs)
  - [x] Check session expiration and renewal logic → **7 days expiry, 1 day renewal** (SESSION_MAX_AGE/UPDATE_AGE)
  - [x] Test session fixation protection → **YES** (Better Auth rotates tokens on login)
- [x] **Rate Limiting Verification** (Phase 4.1)
  - [x] Verify all auth endpoints are rate-limited → **YES** (login, register, password change, delete account, avatar upload)
  - [x] Test brute-force protection on login → 5 req/60s limit + 429 response
  - [x] Monitor rate limit violations in production → Logged to audit logs (`security.rate_limit.hit`)
- [x] **SQL Injection Prevention**
  - [x] Confirm all queries use Drizzle ORM (no raw SQL) → **YES** (verified all API routes)
  - [x] Review dynamic query construction → Safe `sql` template literals with parameterization
  - [x] Test with SQL injection payloads → See [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) Section 4
- [x] **XSS Protection**
  - [x] Verify React escapes user input by default → **YES** (JSX auto-escaping)
  - [x] Check for dangerouslySetInnerHTML usage → **1 safe usage** (root layout, server-side config injection)
  - [x] Review markdown rendering (if any) → **N/A** (no markdown rendering)
- [x] **Input Validation**
  - [x] All API endpoints validate input types → **YES** (required field checks + type validation)
  - [x] Email format validation → **YES** (Better Auth handles this)
  - [x] Password complexity requirements documented → **Min 8 characters** (client + server)
  - [x] Calendar name sanitization → React auto-escaping (no additional sanitization needed)
- [x] **Security Headers Implementation**
  - [x] Add security headers in `proxy.ts`:
    - `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
    - `X-Frame-Options: DENY` - Prevents clickjacking
    - `X-XSS-Protection: 1; mode=block` - Browser XSS filter
    - `Referrer-Policy: strict-origin-when-cross-origin` - Limits referer leakage
    - `Content-Security-Policy` - Restricts resource loading (Next.js-compatible)
- [x] **Better Auth Cookie Configuration**
  - [x] Updated `lib/auth.ts`:
    - `useSecureCookies` now based on HTTPS detection (`BETTER_AUTH_URL.startsWith("https://")`)
    - Explicit `defaultCookieAttributes` for defense in depth
    - `sameSite: "lax"`, `secure: true` (HTTPS), `httpOnly: true`

**Implementation Notes**:

- Better Auth provides comprehensive CSRF protection **when `trustedOrigins` is configured**
- **CRITICAL FIX**: `BETTER_AUTH_TRUSTED_ORIGINS` now defaults to `BETTER_AUTH_URL` instead of empty array (prevented origin validation from being disabled)
- Custom security headers added to `proxy.ts` for defense in depth
- CSP allows `unsafe-inline`/`unsafe-eval` for Next.js compatibility (can be hardened with nonce-based CSP in future)
- All database queries use Drizzle ORM's parameterized queries (no SQL injection vectors)
- React auto-escaping prevents XSS attacks (no unsafe DOM manipulation found)

### 4.5 Background Service Security ✅

**Priority**: High

**Goal**: Ensure background sync service respects calendar ownership and permissions.

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

- [x] **Orphaned Calendar Detection**
  - [x] Update `lib/auto-sync-service.ts`
    - Check if calendar has owner before syncing (only when `AUTH_ENABLED=true`)
    - Skip sync for orphaned calendars (`ownerId = null`)
    - Log warning: "Sync skipped for calendar [id] - no owner"
- [x] **Sync Failure Handling**
  - [x] If owner deleted during sync: abort gracefully (jobs removed from queue)
  - [x] If external sync deleted: clean up from sync queue (handled in loadSyncs)
  - [x] Retry logic for transient failures (handled by existing error handling in syncExternalCalendar)
- [x] **Audit Logging** (Phase 4.2)
  - [x] Success and failure already logged in audit log via `syncExternalCalendar`
  - [ ] Log orphaned sync deactivation in Admin Panel (Phase 9) - see note below
- [x] **Orphaned Sync Cleanup**
  - [x] Set `autoSyncInterval = 0` for external syncs when calendar loses owner
  - [x] Reactivate possible (new owner can manually re-enable auto-sync)
  - [x] Periodic cleanup job for orphaned syncs (runs every 24h, min 1h between runs)

**Implementation Notes**:

- Only enforces owner checks when `AUTH_ENABLED=true` (backwards compatible)
- Uses existing `autoSyncInterval = 0` mechanism (no new DB fields needed)
- Cleanup job runs in background, minimum 1 hour throttling to prevent excessive checks
- Orphaned sync deactivation will be logged to audit log when Admin Panel is implemented (Phase 9)

---

## Phase 5: Calendar Sharing Features

**Design Note**: This phase introduces a unified share management interface with tab-based navigation. Guest permissions (from Phase 3.4) will be **moved** from `calendar-settings-sheet.tsx` into the new `calendar-share-management-sheet.tsx` for better UX cohesion.

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

### 5.1 Sharing API

**Audit Logging**: Integrate these events into the sharing API endpoints:

- [x] **Calendar shared** - `app/api/calendars/[id]/shares/route.ts` POST
  - Action: `"calendar.shared"`
  - Metadata: `{ calendarName, sharedWith, permission }`
- [x] **Calendar share removed** - `app/api/calendars/[id]/shares/[shareId]/route.ts` DELETE
  - Action: `"calendar.share.removed"`
  - Metadata: `{ calendarName, removedUser, removedBy: 'owner' | 'admin' | 'self' }`
- [x] **Calendar permission changed** - `app/api/calendars/[id]/shares/[shareId]/route.ts` PUT

  - Action: `"calendar.permission.changed"`
  - Metadata: `{ calendarName, user, oldPermission, newPermission }`

- [x] Create `app/api/calendars/[id]/shares/route.ts`
  - GET: List all shares for calendar (admin/owner only)
  - POST: Share calendar with user (admin/owner only) + log `"calendar.shared"` event
- [x] Create `app/api/calendars/[id]/shares/[shareId]/route.ts`
  - PUT: Update share permission (admin/owner only) + log `"calendar.permission.changed"` event
  - DELETE: Remove share (admin/owner or self) + log `"calendar.share.removed"` event

### 5.2 User Search/Invite

- [x] Create `app/api/users/search/route.ts`
  - Search users by email/name
  - Exclude already shared users

### 5.3 Sharing UI Components

**Design**: Unified tab-based share management with future-proof structure

- [x] Create `components/calendar-share-management-sheet.tsx` (Main Container)

  - **Tab System**: Uses shadcn/ui Tabs component
  - **Tab 1: "User Shares"** (`calendar-share-list.tsx`)
    - List current user shares (table/card layout)
    - User search/select component (autocomplete)
    - Permission dropdown (admin/write/read)
    - Add/remove shares
    - Show who shared the calendar
    - Show share creation date
  - **Tab 2: "Guest Access"** (moved from calendar-settings-sheet)
    - Guest permission selector (none/read/write)
    - Info text explaining guest behavior
    - Only visible when `isAuthEnabled && allowGuest`
  - **Tab 3: "Access Links"** (Phase 6 - prepared but disabled)
    - Token list (empty state for now)
    - Placeholder: "Available in Phase 6"
    - Tab disabled until Phase 6 implementation
  - Consistent header with gradient background (match app design)
  - Footer with "Close" button

- [x] Create `components/calendar-share-list.tsx` (User Shares Tab Content)

  - Data table with columns: User, Permission, Shared By, Date, Actions
  - Row actions: Edit permission, Remove share
  - "Add User" button → Opens user search dialog
  - Empty state: "No users have access yet"
  - Loading skeleton during fetch

- [x] Create `components/calendar-share-user-search.tsx` (Add User Dialog)

  - Search input with debounce
  - User results list (avatar, name, email)
  - Permission selector (before adding)
  - "Add" button
  - Exclude already shared users from results

- [x] Update `components/calendar-settings-sheet.tsx`

  - **Remove**: Guest permission selector (moved to share management)
  - **Add**: "Manage Sharing" button (replaces guest permission section)
    - Button with Users icon
    - Only visible for owner/admin permission
    - Opens `calendar-share-management-sheet`
  - Keep: Name, Color, External Sync, Export, Delete sections

- [x] Add translations (en, de, it)
  - `share.manageSharing` - "Manage Sharing"
  - `share.userShares` - "User Shares" (tab)
  - `share.guestAccess` - "Guest Access" (tab)
  - `share.accessLinks` - "Access Links" (tab - Phase 6)
  - `share.addUser` - "Add User"
  - `share.noShares` - "No users have access yet"
  - `share.sharedBy` - "Shared by {name}"
  - `share.sharedOn` - "Shared on {date}"
  - ✅ 57 translation keys added

### 5.4 Sharing Hooks

- [x] Create `hooks/useCalendarShares.ts`
  - `fetchShares(calendarId)`
  - `addShare(calendarId, userId, permission)`
  - `updateShare(shareId, permission)`
  - `removeShare(shareId)`
  - `searchUsers(query)`
- [x] Update `useCalendars` hook
  - Include `sharePermission`, `isSubscribed`, `subscriptionSource` fields (via API)
  - Permissions handled via `useCalendarPermission` hook
  - Share metadata available in calendar objects from API

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

**Completed**:

- ✅ All API routes with audit logging
- ✅ User search with share exclusion
- ✅ Tab-based share management sheet with sticky close button
- ✅ User shares list with permission management
- ✅ User search dialog with debounce
- ✅ Guest permissions moved to share sheet
- ✅ Self-removal support ("Leave Calendar")
- ✅ Admin permission restrictions (only owner can grant/modify admin shares)
- ✅ Shared calendar indicator in calendar selector ("geteilt" badge)
- ✅ Share metadata included in calendar objects (sharePermission, isSubscribed, subscriptionSource)
- ✅ Translations (en, de, it) - 57 keys

**Implementation Notes**:

- Share metadata (sharePermission, isOwner) is enriched in GET `/api/calendars` endpoint
- Permission checks use `useCalendarPermission` hook (client-side) and `checkPermission` (server-side)
- Admin permissions can only be granted/modified by calendar owner (not by other admins)
- Share management sheet has sticky footer with close button for better UX

---

## Phase 5.5: UX Polish & Consistency (Share Features)

**Goal**: Improve user experience and consistency across share-related features.

**Status**: ✅ **COMPLETED** (29. Dezember 2025)

### 5.5.1 Table Component Consistency

**Issue**: Activity Log (`app/profile/activity/page.tsx`) uses custom HTML table instead of shadcn/ui Table component, while Calendar Share List uses the proper component.

**Tasks**:

- [x] Refactor Activity Log table to use shadcn/ui components
  - [x] Replace custom `<table>` with `<Table>` from `@/components/ui/table`
  - [x] Use `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
  - [x] Maintain expandable row functionality
  - [x] Keep all existing sorting/filtering logic
  - [x] Preserve responsive design (mobile layout)

**Benefits**:

- Consistent styling across the application
- Better accessibility (ARIA attributes from Radix UI)
- Easier maintenance with shared component
- Automatic theme support

### 5.5.2 Calendar Discovery Dialog Enhancement

**Issue**: Calendar Discovery Dialog is confusing when handling subscriptions and dismissed calendars. Current flow:

1. Guest calendars appear as "unsubscribed" initially
2. After subscribing then unsubscribing → shown as "hidden"
3. No clear distinction between user-shared and guest-accessible calendars

**New Design**: **Three-Tab Layout** for better organization

**Tab 1: "Shared with You"** (User Shares)

- Shows calendars directly shared with the current user via `calendarShares`
- Source: User shares (explicit permission from another user)
- Badge: "Shared with you" with UserPlus icon
- Permission badge: Read-only (Eye) or Edit (Edit icon)
- Toggle: Subscribe/Unsubscribe switch
- Empty state: "No calendars shared with you yet"

**Tab 2: "Public Calendars"** (Guest Accessible)

- Shows calendars with `guestPermission != "none"`
- Source: Guest access (owner enabled public access)
- Badge: "Public" with Globe icon
- Permission badge: Read-only (Eye) or Edit (Edit icon)
- Toggle: Subscribe/Unsubscribe switch
- Empty state: "No public calendars available"

**Tab 3: "Hidden"** (Dismissed Calendars)

- Shows all dismissed calendars (both user-shared and public)
- Source: Previously subscribed but dismissed
- Badge: "Hidden" with EyeOff icon
- Show original source (Shared/Public) as secondary indicator
- Action: "Show Again" button (instead of toggle)
- Empty state: "No hidden calendars"
- Visual: Reduced opacity to indicate inactive state

**Tasks**:

- [x] ~~Update `components/calendar-discovery-dialog.tsx`~~ → **Converted to Sheet** (`calendar-discovery-sheet.tsx`)
  - [x] Add Tabs component from shadcn/ui
  - [x] Create three tab sections: "Shared", "Public", "Hidden"
  - [x] Separate calendars by source:
    - `source: "shared"` → Tab 1
    - `source: "guest"` → Tab 2 (renamed from "public")
    - dismissed → Tab 3 (both sources)
  - [x] Update badge styling per tab
  - [x] Change "Hidden" tab action from toggle to "Show Again" button
  - [x] Add empty states for each tab
  - [x] Improve responsive layout (mobile-friendly tabs)
  - [x] **Bonus**: Converted to Sheet for better vertical space and consistency
- [x] Update `hooks/useCalendarSubscriptions.ts`
  - [x] Add `source` field to `AvailableCalendar` type
  - [x] Distinguish between `"shared"` and `"guest"` sources
  - [x] Filter calendars by source for each tab
  - [x] Maintain dismissed calendars across both sources
  - [x] **Fix**: Live updates - dismissed items now properly move between arrays
- [x] Update `app/api/calendars/subscriptions/route.ts`
  - [x] Return `source` field in available calendars:
    - `"shared"` if calendar has user share entry
    - `"guest"` if calendar has guestPermission != "none"
  - [x] Include source in dismissed calendars response
- [x] Add translations (en, de, it)
  - [x] `calendar.sharedTab` - "Shared with You"
  - [x] `calendar.publicTab` - "Public Calendars"
  - [x] `calendar.hiddenTab` - "Hidden"
  - [x] `calendar.noSharedCalendars` - "No calendars shared with you yet"
  - [x] `calendar.noPublicCalendars` - "No public calendars available"
  - [x] `calendar.noHiddenCalendars` - "No hidden calendars"
  - [x] `calendar.showAgain` - "Show Again"
  - [x] `calendar.publicBadge` - "Public"

**Benefits**:

- Clear visual separation between user-shared and public calendars
- Easier to find specific calendar types
- Less confusion about subscription states
- Consistent "Show Again" action for hidden calendars
- Better onboarding for new users

### 5.5.3 Activity Log for Share Operations

**Issue**: Share operations (add user, remove user, change permission, change guest access) are not logged in the Activity Log.

**New Audit Events**:

1. **User Share Added**
   - Event: `calendar_user_share_added`
   - Type: `calendar`
   - Severity: `info`
   - Message: "Shared calendar '{calendarName}' with {targetUserName} ({targetUserEmail}) as {permission}"
   - Metadata:
     ```json
     {
       "calendarId": "uuid",
       "calendarName": "Work Schedule",
       "targetUserId": "uuid",
       "targetUserName": "John Doe",
       "targetUserEmail": "john@example.com",
       "permission": "write",
       "actorId": "uuid",
       "actorName": "Jane Smith"
     }
     ```
2. **User Share Removed**
   - Event: `calendar_user_share_removed`
   - Type: `calendar`
   - Severity: `info`
   - Message: "Removed {targetUserName}'s access to calendar '{calendarName}'"
   - Metadata:
     ```json
     {
       "calendarId": "uuid",
       "calendarName": "Work Schedule",
       "targetUserId": "uuid",
       "targetUserName": "John Doe",
       "targetUserEmail": "john@example.com",
       "removedBy": "owner | admin | self",
       "actorId": "uuid",
       "actorName": "Jane Smith"
     }
     ```
3. **User Share Permission Changed**
   - Event: `calendar_user_share_permission_changed`
   - Type: `calendar`
   - Severity: `info`
   - Message: "Changed {targetUserName}'s permission on '{calendarName}' from {oldPermission} to {newPermission}"
   - Metadata:
     ```json
     {
       "calendarId": "uuid",
       "calendarName": "Work Schedule",
       "targetUserId": "uuid",
       "targetUserName": "John Doe",
       "oldPermission": "read",
       "newPermission": "write",
       "actorId": "uuid",
       "actorName": "Jane Smith"
     }
     ```
4. **Guest Permission Changed**
   - Event: `calendar_guest_permission_changed`
   - Type: `calendar`
   - Severity: `info`
   - Message: "Changed guest access for '{calendarName}' from {oldPermission} to {newPermission}"
   - Metadata:
     ```json
     {
       "calendarId": "uuid",
       "calendarName": "Work Schedule",
       "oldPermission": "none",
       "newPermission": "read",
       "actorId": "uuid",
       "actorName": "Jane Smith"
     }
     ```

**Tasks**:

- [x] Update `lib/db/schema.ts` - `auditLogs` table
  - [x] Verify action column supports new event types
  - [x] Ensure metadata column can store actor/target user info
- [x] Update `app/api/calendars/[id]/shares/route.ts`
  - [x] **POST** (Add User Share): Emit `calendar_user_share_added` event
    - Include targetUser info (id, name, email)
    - Include permission level
    - Include actor info (current user)
  - [x] **GET**: No changes (read-only)
- [x] Update `app/api/calendars/[id]/shares/[shareId]/route.ts`
  - [x] **PATCH** (Update Permission): Emit `calendar_user_share_permission_changed`
    - Include oldPermission and newPermission
    - Include targetUser info
    - Include actor info
  - [x] **DELETE** (Remove Share): Emit `calendar_user_share_removed`
    - Include targetUser info
    - Include removedBy context (owner/admin/self)
    - Include actor info
- [x] Update `app/api/calendars/[id]/route.ts`
  - [x] **PATCH** (Update Calendar): Check if `guestPermission` changed
    - If changed: Emit `calendar_guest_permission_changed`
    - Include oldPermission and newPermission
    - Include actor info
- [x] Update Activity Log UI (`app/profile/activity/page.tsx`)
  - [x] Add translations for new event types
  - [x] Format share events with actor → target relationship
  - [x] Show permission changes clearly (old → new)
  - [x] Add icons for share events (UserPlus, UserMinus, Shield)
- [x] Add translations (en, de, it)
  - [x] `activityLog.calendar_user_share_added`
  - [x] `activityLog.calendar_user_share_removed`
  - [x] `activityLog.calendar_user_share_permission_changed`
  - [x] `activityLog.calendar_guest_permission_changed`

**Benefits**:

- Full audit trail of all share operations
- Accountability for permission changes
- Helps debug access issues ("Who removed my access?")
- Security monitoring (detect unauthorized share changes)

### 5.5.4 Calendar Creation Simplification

**Decision**: **Remove Guest Permission selector from calendar creation** - All share features should be in Share Management Sheet.

**Changes**:

- [x] Update `components/calendar-sheet.tsx`
  - [x] Remove `GuestPermissionSelector` component
  - [x] Remove `guestPermission` state
  - [x] Remove `guestPermission` parameter from `onSubmit` callback
  - [x] Update `onSubmit` signature to only accept `(name, color)`
  - [x] Remove `isAuthEnabled` and `allowGuest` checks for guest section
  - [x] Simplify `hasChanges()` to only check name and color
- [x] Update parent components calling `CalendarSheet`
  - [x] `app/page.tsx`: Update `handleCreateCalendar` callback
    - Remove `guestPermission` parameter
    - Default to `guestPermission: "none"` in API call
  - [x] Any other components using `CalendarSheet`
- [x] Update `app/api/calendars/route.ts` (POST)
  - [x] Remove `guestPermission` from request body (or ignore if provided)
  - [x] Always set `guestPermission: "none"` for new calendars
  - [x] Update TypeScript types if needed
- [x] Update `hooks/useCalendars.ts`
  - [x] Update `createCalendar` function signature
  - [x] Remove `guestPermission` parameter
  - [x] Default to `"none"` in API payload

**Rationale**:

- **Consistency**: All share features (user shares + guest access) in ONE place (Share Management Sheet)
- **Simpler UX**: Creation flow focuses on essentials (name + color only)
- **Security**: Prevents accidental creation of publicly accessible calendars
- **Clarity**: Guest access is clearly a "sharing" feature, not a "creation" option
- **Industry Standard**: Matches Google Calendar, Outlook, etc. (create private, share later)
- **Better Discoverability**: Users know where to find ALL share options

**User Flow After Changes**:

1. User clicks "Create Calendar"
2. Enters name and color → Save
3. Calendar created with `guestPermission: "none"` (private by default)
4. To enable guest access: Open Share Management Sheet → "Guest Access" tab
5. To share with users: Open Share Management Sheet → "User Shares" tab

---

## Phase 6: Calendar Access Tokens (Easy Share Links)

**Goal**: Enable low-friction calendar sharing via simple links (like old password system, but secure).

**Status**: ✅ **COMPLETED** (30. Dezember 2025)

### 6.1 Database Schema - Access Tokens

**Design Decisions**:

- **Token Storage**: Plain text (not hashed) for simpler UX (partial preview "abc...xyz")
- **Token Format**: base64url encoded (`crypto.randomBytes(32).toString('base64url')`) → 43 chars, URL-safe
- **Security**: Database access controls + audit logging + rate limiting (defense in depth)

- [x] Create `calendarAccessTokens` table in `lib/db/schema.ts`
  - `id` (text, primary key, UUID)
  - `calendarId` (text, references calendars, cascade delete)
  - `token` (text, unique, indexed) - base64url token (43 chars)
  - `name` (text, nullable) - Optional label (e.g., "Family Link", "Work Team")
  - `permission` (text: "read" | "write") - Access level for token holder
  - `expiresAt` (timestamp, nullable) - Optional expiration date
  - `createdBy` (text, references users) - Creator of token
  - `createdAt` (timestamp)
  - `lastUsedAt` (timestamp, nullable) - Track last access
  - `usageCount` (integer, default 0) - Track how often used
  - `isActive` (boolean, default true) - Can be disabled without deletion
- [x] Add unique index on `token` column
- [x] Add index on `(calendarId, isActive)` for quick lookups
- [x] Generate migration: `npm run db:generate` → `0014_dizzy_nebula.sql`

### 6.2 Token Middleware & Authentication

**Cookie Strategy**: Store validated tokens in `calendar_access_tokens` cookie (httpOnly, secure, SameSite=Lax)

- Cookie value: JSON array of objects `[{token: "abc...", calendarId: "uuid", permission: "read"}]`
- Allows multiple token-based calendar accesses simultaneously
- Persists across sessions (until token revoked or cookie cleared)

- [x] Create `lib/auth/token-auth.ts`
  - `validateAccessToken(token: string)` - Check if token is valid, active, not expired
  - `getCalendarByToken(token: string)` - Get calendar + permission
  - `updateTokenUsage(tokenId: string)` - Update lastUsedAt & usageCount (async, non-blocking)
  - `storeTokenInCookie(token: string, calendarId: string, permission: string, response: NextResponse)` - Add to cookie array
  - `getTokensFromCookie(request: NextRequest)` - Parse cookie, return validated tokens
  - `generateAccessToken()` - Generate secure base64url token
  - `getTokenPermission(calendarId)` - Get permission from cookie tokens
- [x] Update `proxy.ts` middleware
  - Check for `/share/token/[token]` in URL path
  - Validate token → get calendarId
  - Store validated token in secure cookie (httpOnly, secure, SameSite=Lax)
  - Redirect to clean URL: `/?id={calendarId}` (token removed from URL)
  - Update token usage stats asynchronously (non-blocking)
  - Audit logging for token usage (success/failure)
- [x] Update `lib/auth/permissions.ts`
  - Extend `getUserCalendarPermission()` to check cookie tokens
  - Parse `calendar_access_tokens` cookie via `getTokenPermission()`
  - Token permissions apply alongside user permissions (highest permission wins)
  - Tokens grant access even if user not logged in (userId = null)

### 6.3 Token Management API

- [x] Create `app/api/calendars/[id]/tokens/route.ts`
  - **GET**: List all tokens for calendar (owner/admin only)
    - Return: token (partial, first 6 + last 6 chars), name, permission, expiresAt, lastUsedAt, usageCount
    - Never return full token (security)
  - **POST**: Create new access token (owner/admin only)
    - Body: `{ name?, permission, expiresAt? }`
    - Generate secure random token (crypto.randomBytes)
    - Return: Full token (only shown once!)
    - Audit log: `calendar_token_created`
- [x] Create `app/api/calendars/[id]/tokens/[tokenId]/route.ts`
  - **PATCH**: Update token (owner/admin only)
    - Update: name, permission, expiresAt, isActive
    - Cannot change token itself (security)
    - Audit log: `calendar_token_updated`
  - **DELETE**: Delete token (owner/admin only)
    - Revokes access immediately
    - Cascade cleanup handled by foreign key constraint
    - Audit log: `calendar_token_revoked`

### 6.4 Token UI Components (Integrate with Share Management Sheet)

- [x] Create `components/calendar-token-list.tsx` (Access Links Tab Content)
  - **Replaces placeholder from Phase 5** (Tab 3 in share management sheet)
  - Data table with columns: Name, Token Preview, Permission, Expires, Usage, Status, Actions
  - Token preview (partial, first 6 + last 6 chars, e.g., "abc123...xyz789")
  - **Usage Stats Display**: Show "Used {count} times" + relative time "Last used 2 hours ago" (or "Never used")
  - Row actions: Enable/Disable toggle, Revoke
  - "Create Link" button → Opens token create dialog
  - Empty state: "No access links yet" with "Create Link" CTA
  - Loading skeleton during fetch
  - Sorted by creation date (newest first)
- [x] Create `components/calendar-token-create-dialog.tsx`
  - Input: Token name (optional, e.g., "Family Link")
  - Select: Permission level (read/write)
  - Date picker: Expiration date (optional, with presets: 1 day, 7 days, 30 days, never)
  - Generate button → Show full token **once** with copy button
  - Warning: "Save this token now - it won't be shown again"
  - Generate shareable link: `${baseUrl}/share/token/${token}`
  - Success state: Show generated link with one-click copy
  - Two-step process: Configure → Success with link
- [x] Create `components/calendar-token-badge.tsx` (Calendar Display)
  - Show "Accessed via Share Link" indicator for token-based access
  - Show permission level (read/write badge)
  - Show token name if available (tooltip)
  - Icon: Link icon for token-based access
  - Variants: full (with text) and compact (icons only)
- [x] Update `components/calendar-share-management-sheet.tsx`
  - **Enable Tab 3** ("Access Links")
  - Load `calendar-token-list.tsx` component
  - Remove placeholder content
  - Fully functional token management interface

### 6.5 Token Hooks

- [x] Create `hooks/useCalendarTokens.ts`
  - `fetchTokens(calendarId)` - List tokens (owner/admin only)
  - `createToken(calendarId, name?, permission, expiresAt?)` - Generate new token, returns full token!
  - `updateToken(tokenId, updates)` - Modify token settings
  - `deleteToken(tokenId)` - Revoke token
  - `getShareLink(token)` - Generate shareable URL
  - `copyShareLink(token)` - Copy full URL to clipboard

### 6.6 Token Access Flow

**User Journey:**

1. **Owner generates token:**

   - Click "Share" in calendar settings sheet
   - Switch to "Access Links" tab
   - Choose "Create Share Link"
   - Set permission (read/write) & optional expiration
   - Copy generated link: `https://app.example.com/share/token/xyz123`

2. **Recipient opens link:**

   - Opens: `https://app.example.com/share/token/abc123xyz456def789`
   - Middleware validates token (active, not expired)
   - Token stored in secure httpOnly cookie: `calendar_access_tokens`
   - **Redirect to clean URL**: `https://app.example.com/?id=calendarId`
   - User sees calendar with token-granted permissions
   - Banner: "You're viewing this calendar via share link (PERMISSION_LEVEL)"
   - Token usage stats updated (lastUsedAt, usageCount++)

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

- [x] **Token Generation**
  - [x] Use `crypto.randomBytes(32)` for 256-bit entropy
  - [x] Encode with `.toString('base64url')` for URL-safe tokens (43 chars)
  - [x] Implemented via `generateAccessToken()` in `lib/auth/token-auth.ts`
- [x] **Token Storage**
  - [x] **Store tokens in plain text** (design decision for UX: partial preview)
  - [x] Security via: DB access controls + audit logging + rate limiting
  - [x] Unique constraint on `token` column prevents duplicates
  - [x] Return full token only once on creation (warning in UI)
- [x] **Cookie Security**
  - [x] httpOnly flag (prevent XSS access)
  - [x] secure flag (HTTPS only in production)
  - [x] SameSite=Lax (CSRF protection)
  - [x] Max age: 90 days (or until token revoked)
- [x] **Rate Limiting** (Future Enhancement)
  - [x] Token validation: 20 requests per minute per IP
  - [x] Token creation: 10 tokens per hour per calendar
  - [x] Return `429 Too Many Requests` on limit exceeded
- [x] **Audit Logging** (Phase 4.2)
  - [x] Log token creation (action: `"calendar_token_created"`, metadata: `{ calendarId, tokenName, permission, expiresAt }`)
  - [x] Log token revocation (action: `"calendar_token_revoked"`, metadata: `{ calendarId, tokenName, revokedBy }`)
  - [x] Log token access attempts (success: `"calendar_token_used"`, failure: `"calendar_token_invalid"`)
  - [x] Log token permission/status changes (action: `"calendar_token_updated"`)
- [x] **Token Lifecycle**
  - [x] Show token usage statistics in UI (last used, total count)
  - [x] Auto-expire based on `expiresAt` field (checked on validation)

**Implementation Notes**:

- Tokens stored in plain text for UX (partial preview: first 6 + last 6 chars)
- Cookie-based storage allows multiple simultaneous token accesses
- Middleware validates tokens before redirecting to clean URLs (`/?id=xxx`)
- Permission priority: Owner > Shared > Token > Guest
- Usage stats updated asynchronously (non-blocking)
- Full token only shown once during creation (security best practice)

### 6.8 Token vs Guest vs User Shares Comparison

| Feature         | Guest Access (3.4)      | Access Tokens (6)             | User Shares (5)    |
| --------------- | ----------------------- | ----------------------------- | ------------------ |
| **Use Case**    | Public calendars        | Private link sharing          | Team collaboration |
| **Setup**       | Set calendar public     | Generate share link           | Invite by email    |
| **Recipient**   | No account needed       | No account needed             | Account required   |
| **Revocation**  | Disable guest mode      | Delete token                  | Remove share       |
| **Granularity** | Per calendar            | Per link/token                | Per user           |
| **Audit Trail** | Guest permission change | Token usage stats + audit log | User activity log  |
| **Persistence** | Always accessible       | Until revoked                 | Until removed      |
| **Example**     | Public team shifts      | Share with family             | Work calendar      |

---

## Phase 7: Data Migration - Orphaned Calendars on Auth Toggle

**Scenario**: User creates calendars with `AUTH_ENABLED=false` (ownerId=null), then enables auth later.

**Priority**: Medium (Important for self-hosted instances)

**Goal**: Automatically handle orphaned calendars when auth is enabled.

**Status**: ✅ **COMPLETED** (30. Dezember 2025)

**Design Decision**: Use Better Auth's built-in Admin Plugin for role management instead of custom implementation.

### 7.1 Better Auth Admin Plugin Integration

**Why Better Auth Admin Plugin?**

- Built-in `role` field on `user` table (no custom schema needed)
- Support for multiple admin roles: `superadmin`, `admin`
- Complete user management API (ban, impersonate, setRole, etc.)
- Access control system for future features
- Industry-standard implementation

- [x] **Add Better Auth Admin Plugin**
  - [x] Update `lib/auth.ts`:
    - Import `admin` plugin from `better-auth/plugins`
    - Add to plugins array with config (simplified to use default roles)
  - [x] Update `lib/auth/client.ts`:
    - Import `adminClient` from `better-auth/client/plugins`
    - Add to client plugins array
  - [x] Generate migration: `npx @better-auth/cli generate`
    - Adds `role`, `banned`, `banReason`, `banExpires` to `user` table
    - Adds `impersonatedBy` to `session` table
  - [x] Apply migration: `npm run db:migrate` → `0013_first_phantom_reporter.sql`

### 7.2 First User Auto-Promotion

**Requirement**: First registered user automatically becomes `superadmin` for initial setup.

- [x] **Update Registration Logic**
  - [x] Create `lib/auth/first-user.ts`:
    - `isFirstUser(userId)` - Check if this is the only user in database
    - `promoteToSuperAdmin(userId)` - Set role to "superadmin"
    - `handleFirstUserPromotion(userId)` - Main function called from hook
  - [x] Update `lib/auth.ts` with after hook:
    - Added `createAuthMiddleware` after hook for sign-up
    - Automatically promotes first user to superadmin
    - Logs to audit log: `user_promoted_to_superadmin`
    - Non-blocking execution (doesn't delay response)

### 7.3 Admin Role Helpers

- [x] **Create `lib/auth/admin.ts`**
  - [x] `isAdmin(user)` - Check if user has `admin` or `superadmin` role
  - [x] `isSuperAdmin(user)` - Check if user has `superadmin` role specifically
  - [x] `requireAdmin(user)` - Throw error if not admin (for API routes)
  - [x] `requireSuperAdmin(user)` - Throw error if not superadmin (for API routes)
  - [x] `getAdminLevel(user)` - Get user's admin level for display

### 7.4 API Protection for Orphaned Calendars

**Current State**: Orphaned calendars (ownerId=null) are already invisible to normal users via permission system.

**New Requirement**: Orphaned calendars are invisible in normal UI for **ALL users** (including admins). Only visible in dedicated Admin Panel.

- [x] **Update `lib/auth/permissions.ts`**

  - [x] Extend `getUserCalendarPermission()`:
    - If `calendar.ownerId === null`:
      - Return `null` (no permission for ANY user, including admins)
      - Orphaned calendars are excluded from normal calendar lists
  - [x] Add `getOrphanedCalendars()` function (admin only):
    - Query: `SELECT * FROM calendars WHERE ownerId IS NULL`
    - Returns orphaned calendars for Admin Panel only
    - Requires admin role check before calling
    - Used by Admin Panel in Phase 9.3

- [x] **Verify Calendar API Routes**
  - [x] `app/api/calendars/route.ts` GET:
    - ✅ Uses `getUserAccessibleCalendars()` which excludes orphaned calendars
    - Normal calendar list never returns orphaned calendars
  - [x] `app/api/calendars/[id]/route.ts` GET/PUT/PATCH/DELETE:
    - ✅ Uses `canViewCalendar()` which returns false for orphaned calendars
    - Direct access to orphaned calendar by ID returns 403

### 7.5 Future: Admin Panel (Phase 9.3)

**Out of Scope for Phase 7** - Will be implemented in Phase 9.3:

- UI for orphaned calendar management
- Bulk assignment actions
- User to calendar assignment interface
- Warning banners for orphaned calendars

**Implementation Notes**:

- ✅ **Better Auth Admin Plugin** handles all user role management (no custom schema)
- ✅ **First user auto-promotion** ensures there's always a superadmin
- ✅ **Orphaned calendars** invisible for ALL users in normal UI (including admins)
- ✅ **Admin Panel** (Phase 9.3) will have dedicated API for orphaned calendar management
- ✅ **Backwards compatibility** maintained - orphaned calendars not accessible until assigned
- ✅ **DB migrations** run automatically on container start (Dockerfile)
- ✅ **Documentation** (README, .env.example, migration guides) moved to Phase 10.1

---

## Phase 8: UI/UX Enhancements

### 8.1 Loading States & Skeleton Optimization ✅

**Priority**: High (User Experience Critical)

**Goal**: Implement a single, consistent fullscreen loading pattern across the app to eliminate skeleton flicker and provide a clean initial load experience.

**Decision**: Based on user feedback and UX analysis from other modern apps:

- **Single fullscreen spinner** on initial page load
- **No skeleton components** (completely removed)
- **SSE for real-time updates** after initial load (no additional loading states needed)
- **Optimistic UI** for all user actions (instant feedback)

**Current Problems (Solved):**

1. ~~**Skeleton Flicker**~~: Eliminated by removing all skeletons
2. ~~**Double Loading Feedback**~~: Eliminated by single loading pattern
3. ~~**Router-Induced Re-renders**~~: Handled by per-page loading state
4. ~~**Inconsistent Patterns**~~: Unified to single fullscreen spinner

**Affected Pages:**

- `app/page.tsx` - Main calendar page (Calendars + Shifts + Presets + Notes)
- `app/profile/page.tsx` - Profile page (User + Accounts + Sessions)
- `app/profile/activity/page.tsx` - Activity logs page (Activity + Sync logs)

#### 8.1.1 Create Fullscreen Loading Component

- [x] **Create `components/fullscreen-loader.tsx`**
  - [x] Fullscreen centered spinner with app branding
  - [x] Smooth fade-in animation (prevent flash for very fast loads)
  - [x] Uses Lucide `Loader2` icon with rotation animation
  - [x] Optional loading message (e.g., "Loading your calendars...")
  - [x] Dark/light theme support via theme-provider

#### 8.1.2 Remove All Skeleton Components

- [x] **Delete `components/skeletons/` Directory**
  - [x] `calendar-header-skeleton.tsx`
  - [x] `calendar-compare-header-skeleton.tsx`
  - [x] `calendar-content-skeleton.tsx`
  - [x] `footer-skeleton.tsx`
  - [x] `profile-skeleton.tsx`
  - [x] All other skeleton components

#### 8.1.3 Update Pages with Fullscreen Loader

- [x] **Update `app/page.tsx`**

  - [x] Replace all skeleton imports with `FullscreenLoader`
  - [x] Show loader when `loading || shiftsLoading || presetsLoading`
  - [x] Remove skeleton components from render
  - [x] Ensure SSE connection starts after initial load

- [x] **Update `app/profile/page.tsx`**

  - [x] Replace skeleton with `FullscreenLoader`
  - [x] Show loader when `isLoading || accountsLoading || sessionsLoading`
  - [x] Remove `ProfileContentSkeleton` import

- [x] **Update `app/profile/activity/page.tsx`**
  - [x] Add `FullscreenLoader` component
  - [x] Show loader when `authLoading || loading` (initial load)
  - [x] Keep inline skeletons only for pagination/filters (acceptable)

#### 8.1.4 Loading Feedback Patterns (Updated)

**New Simplified Patterns:**

### 1. Fullscreen Loader (Initial Page Load Only)

- **Use for**: First data fetch when entering a page
- **Examples**: `/`, `/profile`, `/profile/activity`
- **Pattern**: `{isLoading ? <FullscreenLoader /> : <PageContent />}`
- **Duration**: Until all critical data is fetched

### 2. Optimistic UI (User Actions) ✅

- **Use for**: Create/Update/Delete operations triggered by user
- **Examples**: Shift creation, Preset selection, Note editing
- **Pattern**: Update UI immediately, revert on error
- **Already Implemented**: No changes needed

### 3. Inline Spinners (Button Actions) ✅

- **Use for**: Long-running server operations in forms
- **Examples**: "Save" button, "Export" button, "Sync" button
- **Pattern**: Button disabled + spinner icon + "Saving..." text
- **Already Implemented**: No changes needed

### 4. No Loading Feedback (Instant Actions) ✅

- **Use for**: Pure client-side state changes, SSE updates
- **Examples**: Theme toggle, Language switch, Real-time shift updates
- **Pattern**: Immediate state change, no loading indicator
- **Already Implemented**: No changes needed

### 5. Progress Indicators (Long Operations) ✅

- **Use for**: Multi-step processes, file uploads, sync operations
- **Examples**: Calendar export (PDF), External sync, Bulk operations
- **Pattern**: Progress bar or percentage with cancel option
- **Already Implemented**: No changes needed

#### 8.1.5 Verify Optimistic UI (No Regressions)

- [x] **Test User Actions Feel Instant**:
  - [x] Shift creation shows immediately (temp ID pattern)
  - [x] Shift deletion removes from UI instantly
  - [x] Preset selection updates immediately
  - [x] Calendar switching feels instant
  - [x] No loading spinners on button clicks (disabled state only)

**Implementation Priority**: ✅ **COMPLETED**

**Estimated Effort**: 1 day

**Dependencies**: None

**Status**: Ready for production deployment

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
- [ ] **User Ban System**
  - [ ] Add `isBanned` flag to `user` table (boolean, default: false)
  - [ ] Add `bannedAt` timestamp to `user` table (nullable)
  - [ ] Add `bannedBy` to `user` table (references users, nullable)
  - [ ] Add `banReason` text field to `user` table (nullable)
  - [ ] Create `bannedIps` table:
    - `id` (text, primary key)
    - `ipAddress` (text, unique, indexed)
    - `bannedBy` (references users)
    - `bannedAt` (timestamp)
    - `reason` (text, nullable)
    - `expiresAt` (timestamp, nullable for permanent bans)
  - [ ] Create `app/api/admin/users/[id]/ban/route.ts`
    - POST: Ban user account (sets isBanned=true, terminates all sessions)
    - Body: `{ reason: string, alsoIpBan: boolean }`
    - If `alsoIpBan=true`, add user's IPs to `bannedIps` table
  - [ ] Create `app/api/admin/users/[id]/unban/route.ts`
    - POST: Unban user account (sets isBanned=false)
  - [ ] Create `app/api/admin/ip-bans/route.ts`
    - GET: List all banned IPs
    - POST: Add IP to ban list
    - DELETE: Remove IP from ban list
  - [ ] Create `app/api/admin/ip-bans/[ip]/route.ts`
    - DELETE: Unban specific IP address
  - [ ] Middleware enforcement in `proxy.ts`:
    - Check `isBanned` flag before auth middleware
    - Check IP against `bannedIps` table
    - Return 403 Forbidden for banned accounts/IPs
    - Log ban attempts to audit logs
  - [ ] Admin UI Components:
    - [ ] `components/admin/user-ban-dialog.tsx` - Ban user with reason
    - [ ] `components/admin/user-unban-dialog.tsx` - Unban confirmation
    - [ ] `components/admin/banned-users-list.tsx` - View all banned users
    - [ ] `components/admin/banned-ips-list.tsx` - Manage IP ban list
    - [ ] `components/admin/ip-ban-dialog.tsx` - Add IP to ban list
  - [ ] User list UI enhancements:
    - Show "BANNED" badge on banned users
    - Quick ban/unban actions in user list
    - Filter: Show only banned users
  - [ ] Audit logging for ban actions:
    - Action: `"admin.user.ban"` - Account banned
    - Action: `"admin.user.unban"` - Account unbanned
    - Action: `"admin.ip.ban"` - IP address banned
    - Action: `"admin.ip.unban"` - IP address unbanned
    - Metadata: `{ userId, ipAddress, reason, bannedBy }`
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
- [ ] **Orphaned sync deactivation** - Auto-sync service cleanup (Phase 4.5)

  - Action: `"sync.orphaned.disabled"`
  - Metadata: `{ calendarId, syncName, reason: "calendar_has_no_owner" }`
  - Logged by cleanup job when auto-sync is disabled for orphaned calendars
  - Severity: `"warning"`

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

### 9.6 Admin Panel - Access Control

- [ ] Add admin-only middleware check in `proxy.ts`
  - Block `/admin` routes for non-super-admin users
- [ ] Add "Admin Panel" link in user menu (visible only to super admin)
- [ ] Create `hooks/useAdminAccess.ts`
  - `isSuperAdmin` check
  - Redirect non-admins to homepage

### 9.7 Admin Panel UI/UX

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

- [ ] **Update README.md**

  - [ ] Auth system overview
  - [ ] Admin panel features (first user = superadmin)
  - [ ] Public/User/Token share differences
  - [ ] Environment variables
  - [ ] OIDC configuration guide
  - [ ] Migration instructions
  - [ ] **Add section: "Enabling Auth on Existing Instance"** (Phase 7)
    - Prerequisites: Calendars created with `AUTH_ENABLED=false`
    - Steps:
      1. Set `AUTH_ENABLED=true` in `.env`
      2. Restart application (triggers migrations)
      3. Register first user (automatically becomes superadmin)
      4. Login as superadmin
      5. Navigate to Admin Panel → Orphaned Calendars
      6. Assign orphaned calendars to users (or yourself)
    - Warning: Orphaned calendars are invisible in normal UI for all users until assigned

- [ ] **Update `.env.example`**

  - [ ] Add comment to `AUTH_ENABLED`:
    ```bash
    # Enable authentication system (defaults to true)
    # Note: Calendars created with AUTH_ENABLED=false will need owner assignment
    # The first registered user will automatically become superadmin
    AUTH_ENABLED=true
    ```

- [ ] **Create Migration Guide** (`docs/MIGRATION_AUTH_TOGGLE.md`) (Phase 7)

  - [ ] Detailed step-by-step process with screenshots
  - [ ] Troubleshooting section:
    - "What happens to existing calendars?"
    - "Can I undo the auth toggle?"
    - "How to add more admins?"
  - [ ] Best practices:
    - Backup database before enabling auth
    - Assign orphaned calendars immediately after first login
    - Document admin credentials securely

- [ ] **Create `docs/AUTH_SETUP.md`**
  - [ ] Step-by-step setup guide
  - [ ] OIDC provider configuration (Google, GitHub, Discord)
  - [ ] Custom OIDC provider setup (Keycloak, Authentik, etc.)
  - [ ] Self-hosting considerations

### 10.2 Integration Testing

- [ ] Test complete auth flow (register, login, logout)
- [ ] Test permission system with multiple users
- [ ] Test calendar sharing workflows
- [ ] Test access token functionality
- [ ] Test backwards compatibility (AUTH_ENABLED=false)
- [ ] Performance testing with realistic data
- [ ] Cross-browser compatibility testing

---

## Phase 11: Performance Optimizations

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

---

## Success Criteria

- [ ] Auth can be fully disabled (single-user mode works)
- [ ] Auth can be enabled with username/password
- [ ] At least 2 OIDC providers working (Google + GitHub)
- [ ] Custom OIDC provider configuration works
- [ ] Calendar sharing works with all permission levels
- [ ] Existing data migrates successfully
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
- **Auth enabled by default** to ensure security best practices
- **First user becomes admin** on initial auth setup
- **Orphaned calendars** (no owner) will be handled in admin panel
- **Permission hierarchy**: Owner > Admin > Write > Read
- **Environment variables** use `BETTER_AUTH_` prefix (not `AUTH_`)
- **Discovery URL** for custom OIDC should include `/.well-known/openid-configuration`
- **Experimental joins** optional but recommended for 2-3x performance boost
