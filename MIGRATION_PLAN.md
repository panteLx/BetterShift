# Auth System Migration Plan

**Status**: 🔄 In Progress  
**Started**: 22. Dezember 2025  
**Target**: Better Auth mit OIDC + Username/Password  
**Goal**: Multi-User System mit Calendar Sharing & Permissions

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
- [ ] **UI Design Polish**
  - [ ] Align login page with app design (gradients, borders, spacing)
  - [ ] Align register page with app design
  - [ ] Match sheet/dialog styling patterns from main app

### 2.2 User Profile & Settings

- [x] Create `app/profile/page.tsx`
  - Display user info
  - Change password UI
  - Connect/disconnect OIDC accounts UI
  - Delete account option UI
- [ ] **Profile Functionality Implementation**
  - [ ] Create API endpoint for password change (`/api/auth/change-password`)
  - [ ] Create API endpoint for account deletion (`/api/auth/delete-account`)
  - [ ] Implement OAuth account linking/unlinking
  - [ ] Wire up profile page to actual API endpoints
  - [ ] Add proper error handling and validation
- [ ] **UI Design Polish**
  - [ ] Align profile page with app design patterns
  - [ ] Match card styling with calendar settings
  - [ ] Use consistent gradients and borders
- [x] Add user menu dropdown in `AppHeader`
  - Profile link
  - Logout button
  - Show current user

### 2.3 Auth State Management

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

### 2.4 Protected Routes

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

## Phase 7: Testing & Documentation

### 7.1 Testing

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

### 7.2 Documentation

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

### 7.3 Security Review

- [ ] CSRF protection enabled
- [ ] Session security (httpOnly cookies)
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection prevention (Drizzle ORM)
- [ ] XSS protection
- [ ] Input validation on all endpoints

---

## Phase 8: Performance & Polish

### 8.1 Performance Optimization

- [ ] Index `ownerId` column in calendars
- [ ] Index `(calendarId, userId)` in shares
- [ ] Optimize permission checks (caching)
- [ ] Add database query optimization

### 8.2 SSE Updates

- [ ] Emit share events via SSE
- [ ] Real-time calendar share notifications
- [ ] Update `instrumentation.ts` for multi-user

### 8.3 Edge Cases

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

```env
# Auth System
AUTH_ENABLED=true|false                    # Enable/disable entire auth system
BETTER_AUTH_SECRET=<random-secret>         # Session encryption key (use: npx @better-auth/cli secret)
BETTER_AUTH_URL=http://localhost:3000      # Base URL for auth

# Built-in Social Providers (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Generic OAuth Plugin - Microsoft Entra ID (optional)
MS_ENTRA_CLIENT_ID=
MS_ENTRA_CLIENT_SECRET=
MS_ENTRA_TENANT_ID=common                  # or specific tenant GUID

# Generic OAuth Plugin - Custom OIDC Provider (optional)
CUSTOM_OIDC_ENABLED=true|false
CUSTOM_OIDC_NAME="Custom SSO"              # Display name for login button
CUSTOM_OIDC_ISSUER=https://sso.example.com/.well-known/openid-configuration # Discovery URL
CUSTOM_OIDC_CLIENT_ID=
CUSTOM_OIDC_CLIENT_SECRET=
CUSTOM_OIDC_SCOPES=openid profile email    # Space separated

# Session Settings
SESSION_MAX_AGE=604800                     # 7 days (in seconds)
SESSION_UPDATE_AGE=86400                   # 1 day (in seconds)

# Features
ALLOW_USER_REGISTRATION=true|false         # Enable/disable new user signups
REQUIRE_EMAIL_VERIFICATION=false           # Enforce email verification
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

---

## Current Progress: Phase 2 In Progress 🔄

**Completed**:

- ✅ Login/Register pages functional (authentication works)
- ✅ Auth state management with hooks
- ✅ Protected routes via middleware
- ✅ User menu in header

**In Progress**:

- 🔄 Profile page API implementation (password change, account deletion)
- 🔄 UI design polish for auth pages

**Next Step**: Complete Phase 2, then start Phase 3 - Permission System Implementation
