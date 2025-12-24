# Auth System Migration Plan

**Status**: 🔄 In Progress  
**Started**: 22. Dezember 2025  
**Target**: Better Auth mit OIDC + Username/Password  
**Goal**: Multi-User System mit Calendar Sharing & Permissions

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

### 3.1 Permission Utilities

- [ ] Create `lib/auth/permissions.ts`
  - `CalendarPermission` type: "owner" | "admin" | "write" | "read"
  - `checkPermission(userId, calendarId, required)`
  - `getUserCalendarPermission(userId, calendarId)`
  - `canViewCalendar(userId, calendarId)`
  - `canEditCalendar(userId, calendarId)`
  - `canManageCalendar(userId, calendarId)` (admin/owner)
  - `canDeleteCalendar(userId, calendarId)` (owner only)

### 3.2 API Route Protection

- [ ] Update `app/api/calendars/route.ts`
  - GET: Return only owned + shared calendars
  - POST: Set ownerId to current user
- [ ] Update `app/api/calendars/[id]/route.ts`
  - GET: Check read permission
  - PUT: Check admin permission (for rename/settings)
  - DELETE: Check owner permission
- [ ] Update `app/api/shifts/route.ts`
  - GET: Filter by accessible calendars
  - POST: Check write permission
- [ ] Update `app/api/shifts/[id]/route.ts`
  - PUT/DELETE: Check write permission
- [ ] Update `app/api/presets/route.ts`
  - GET: Filter by accessible calendars
  - POST: Check write permission
- [ ] Update `app/api/presets/[id]/route.ts`
  - PUT/DELETE: Check write permission
- [ ] Update `app/api/notes/route.ts` & `[id]/route.ts`
  - Same permission checks as shifts
- [ ] Update `app/api/external-syncs/**` routes
  - Check write permission for calendar

### 3.3 Remove Old Password System

- [ ] Delete `lib/password-utils.ts`
- [ ] Delete `lib/password-cache.ts`
- [ ] Remove password logic from all API routes
- [ ] Remove `usePasswordManagement` hook
- [ ] Remove `usePasswordProtection` hook
- [ ] Remove `PasswordDialog` component
- [ ] Remove `LockedCalendarView` component
- [ ] Remove password-related translations

### 3.4 Guest/Anonymous Access

- [ ] Add `ALLOW_GUEST_ACCESS` environment variable
  - When `true`: Allow viewing calendars without login
  - When `false`: Force login redirect (current behavior)
  - Default: `false` (require login when auth enabled)
- [ ] Add `guestPermission` column to `calendars` table
  - Values: "none" (default) | "read" | "write"
  - Determines what guests can do with this calendar
  - Migration: Add column, default to "none"
- [ ] Update permission utilities (`lib/auth/permissions.ts`)
  - Extend `getUserCalendarPermission()` to handle guest users
  - Return guest permission if no user session
  - Guest permissions never override user permissions
- [ ] Update `proxy.ts` middleware
  - Skip login redirect if `ALLOW_GUEST_ACCESS=true`
  - Allow unauthenticated users to view app
  - Set guest flag in request context
- [ ] Update API route protection
  - Accept requests without auth session (if guest access enabled)
  - Apply guest permissions in all routes
  - Block write operations if guest permission < write
  - Return only guest-accessible calendars
- [ ] UI Updates for Guest Mode
  - Show "Login" button in header for guests
  - Add banner: "You are viewing as guest. Login for full access."
  - Disable create/edit actions based on guest permissions
  - Show lock icons on calendars guests cannot edit
  - Filter calendar list by guest-accessible calendars
- [ ] Calendar Settings Sheet
  - Add "Guest Access" section (owner/admin only)
  - Radio buttons: "No Access" | "Read Only" | "Read & Write"
  - Explanation text about guest behavior
  - Show current guest permission level

**Use Cases**:

- Public calendars (team shifts visible to everyone)
- Demo mode (showcase app without registration)
- Shared family calendar (view-only for relatives)
- Gradual auth adoption (allow browsing before committing)

**Security Considerations**:

- Guest permissions never override user permissions (user = stricter rules)
- Owner/admin required to change guest settings
- Rate limiting applies to guest requests
- No sensitive data exposed to guests (user info, emails, etc.)
- Requires Phase 3.1 & 3.2 to be completed first

---

## Phase 4: Calendar Sharing Features

### 4.1 Sharing API

- [ ] Create `app/api/calendars/[id]/shares/route.ts`
  - GET: List all shares for calendar (admin/owner only)
  - POST: Share calendar with user (admin/owner only)
- [ ] Create `app/api/calendars/[id]/shares/[shareId]/route.ts`
  - PUT: Update share permission (admin/owner only)
  - DELETE: Remove share (admin/owner or self)

### 4.2 User Search/Invite

- [ ] Create `app/api/users/search/route.ts`
  - Search users by email/name
  - Exclude already shared users
- [ ] Implement email invite system (optional)
  - Send invite link for new users
  - Auto-share calendar on registration

### 4.3 Sharing UI Components

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

### 4.4 Sharing Hooks

- [ ] Create `hooks/useCalendarShares.ts`
  - `fetchShares(calendarId)`
  - `addShare(calendarId, userId, permission)`
  - `updateShare(shareId, permission)`
  - `removeShare(shareId)`
- [ ] Update `useCalendars` hook
  - Include `isOwner`, `permission`, `sharedBy` fields
  - Filter out calendars with insufficient permissions

---

## Phase 5: Data Migration

### 5.1 Migration Script

- [ ] Create `lib/migrate-to-auth.ts` script
- [ ] Generate default admin user for existing data
  - Email: `admin@localhost`
  - Set password or force password reset
- [ ] Assign all existing calendars to admin user
- [ ] Mark all calendars as owned (no shares initially)

### 5.2 Migration Execution

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

### 5.3 Backwards Compatibility

- [ ] If `AUTH_ENABLED=false`:
  - Skip authentication checks
  - Show all calendars to everyone
  - Hide user-related UI
  - Use "single-user mode" behavior
- [ ] Add migration guide to README

---

## Phase 6: UI/UX Enhancements

### 6.1 Calendar List Updates

- [ ] Show ownership indicator in `CalendarSelector`
- [ ] Show permission badge (if shared)
- [ ] Group calendars: "My Calendars" vs "Shared with me"
- [ ] Disable delete/rename for non-owners

### 6.2 Permission-Based UI

- [ ] Hide "Delete" button if not owner
- [ ] Disable "Settings" button if not admin
- [ ] Show read-only banner on shared calendars
- [ ] Disable shift editing if permission < write

### 6.3 Notifications & Feedback

- [ ] Show toast when calendar is shared with you
- [ ] Notify owner when someone accepts share
- [ ] Email notifications (optional)

### 6.4 Mobile Optimization

- [ ] Responsive share dialog
- [ ] Touch-friendly permission selector
- [ ] Mobile user search

---

## Phase 7: Admin Panel & Super Admin Features

### 7.1 Super Admin Concept

- [ ] Add `isSuperAdmin` flag to `user` table (boolean, default: false)
- [ ] Migration: Mark first created user as super admin (`ORDER BY createdAt LIMIT 1`)
- [ ] Add helper function `isSuperAdmin(userId)` in `lib/auth/permissions.ts`
- [ ] Super admin bypasses all permission checks (full access to everything)

### 7.2 Admin Panel - User Management

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

### 7.3 Admin Panel - Calendar Management

- [ ] Create `app/api/admin/calendars/route.ts`
  - GET: List all calendars with owner info
  - PUT: Bulk operations (transfer ownership, delete multiple)
- [ ] Create `app/api/admin/calendars/[id]/route.ts`
  - GET: Get calendar details with full stats
  - PUT: Update calendar (rename, change owner, change settings)
  - DELETE: Delete calendar (force delete even with shares)
- [ ] Create `app/api/admin/calendars/[id]/transfer/route.ts`
  - POST: Transfer calendar ownership to another user
- [ ] Admin UI Components:
  - [ ] `components/admin/calendar-list.tsx` - Table of all calendars
  - [ ] `components/admin/calendar-edit-dialog.tsx` - Edit calendar
  - [ ] `components/admin/calendar-transfer-dialog.tsx` - Transfer ownership
  - [ ] `components/admin/calendar-stats.tsx` - Calendar statistics

### 7.4 Admin Panel - System Overview

- [ ] Create `app/api/admin/stats/route.ts`
  - GET: System-wide statistics (users, calendars, shifts, shares)
- [ ] Create `components/admin/system-stats.tsx`
  - Total users count
  - Total calendars count
  - Total shifts count
  - Storage usage (database size)
  - Active sessions count
  - Recent activity log

### 7.5 Admin Panel - Access Control

- [ ] Add admin-only middleware check in `proxy.ts`
  - Block `/admin` routes for non-super-admin users
- [ ] Add "Admin Panel" link in user menu (visible only to super admin)
- [ ] Create `hooks/useAdminAccess.ts`
  - `isSuperAdmin` check
  - Redirect non-admins to homepage
- [ ] Add audit logging for admin actions
  - Log user password changes
  - Log calendar transfers
  - Log user deletions
  - Store in new `admin_logs` table

### 7.6 Admin Panel UI/UX

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

## Phase 8: Testing & Documentation

### 8.1 Testing

- [ ] Test auth disabled mode (backwards compatibility)
- [ ] Test auth enabled mode
- [ ] Test OIDC login flow (Google, GitHub, Discord)
- [ ] Test custom OIDC provider (with Keycloak/Authentik)
- [ ] Test username/password registration
- [ ] Test calendar sharing (all permission levels)
- [ ] Test permission enforcement in API
- [ ] Test data migration with sample data
- [ ] Test concurrent user sessions
- [ ] Test multiple OIDC providers enabled simultaneously

### 8.2 Documentation

- [ ] Update README.md
  - Auth system overview
  - Environment variables
  - OIDC configuration guide
  - Migration instructions
- [ ] Create `docs/AUTH_SETUP.md`
  - Step-by-step setup guide
  - OIDC provider configuration (Google, GitHub, Discord)
  - Custom OIDC provider setup (Keycloak, Authentik, etc.)
  - Self-hosting considerations
- [ ] Create `docs/CUSTOM_OIDC.md`
  - Generic OIDC provider configuration
  - Examples for popular providers (Keycloak, Authentik, Authelia, Zitadel)
  - Troubleshooting OIDC issues
- [ ] Update Docker setup for auth
- [ ] Add environment variable examples

### 8.3 Security Review

- [ ] CSRF protection enabled
- [ ] Session security (httpOnly cookies)
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection prevention (Drizzle ORM)
- [ ] XSS protection
- [ ] Input validation on all endpoints

---

## Phase 9: Performance & Polish

### 9.1 Performance Optimization

- [ ] Index `ownerId` column in calendars
- [ ] Index `(calendarId, userId)` in shares
- [ ] Optimize permission checks (caching)
- [ ] Add database query optimization

### 9.2 SSE Updates

- [ ] Emit share events via SSE
- [ ] Real-time calendar share notifications
- [ ] Update `instrumentation.ts` for multi-user

### 9.3 Edge Cases

- [ ] Handle orphaned calendars (no owner)
- [ ] Handle deleted users (cascade cleanup)
- [ ] Handle calendar transfer (change owner)
- [ ] Handle permission conflicts

---

## Rollout Strategy

### Stage 1: Development (Current)

- Complete Phase 1-3
- Test in local environment
- No production impact

### Stage 2: Beta (Auth Disabled by Default)

- Deploy with `AUTH_ENABLED=false`
- Existing users unaffected
- Optional opt-in for testing

### Stage 3: Migration Window

- Announce auth system availability
- Provide migration guide
- Support period for questions

### Stage 4: Full Rollout

- Default `AUTH_ENABLED=true` for new installations
- Existing installations can enable via env var
- Backwards compatibility maintained

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
NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false      # Enforce email verification (default: false)

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
