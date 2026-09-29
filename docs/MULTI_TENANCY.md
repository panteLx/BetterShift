# Multi-Tenancy Guide

This guide explains BetterShift's optional multi-tenant mode: one running instance serving several isolated workspaces, each reachable on its own subdomain.

## Table of Contents

1. [What a Workspace Is](#what-a-workspace-is)
2. [For Self-Hosters: It's Opt-In](#for-self-hosters-its-opt-in)
3. [Environment Variables](#environment-variables)
4. [The Portal: `BETTER_AUTH_URL` and OAuth Callbacks](#the-portal-better_auth_url-and-oauth-callbacks)
5. [How a Request Resolves to a Workspace](#how-a-request-resolves-to-a-workspace)
6. [Onboarding: Creating and Joining a Workspace](#onboarding-creating-and-joining-a-workspace)
7. [Invite Links](#invite-links)
8. [Members](#members)
9. [Instance Admins](#instance-admins)
10. [Disabled Organization Plugin Endpoints](#disabled-organization-plugin-endpoints)
11. [Out of Scope in This Release](#out-of-scope-in-this-release)
12. [Verifying Isolation](#verifying-isolation)

---

## What a Workspace Is

A workspace is a better-auth **organization** row. Each workspace gets its own subdomain, its own users, calendars, access tokens, announcements and audit logs — nothing is visible or reachable across workspaces. A user can be a member of more than one workspace, but every request only ever sees the one workspace its subdomain resolves to.

Single-tenant instances (the default) still have exactly one workspace, called `default` — multi-tenancy just makes that concept explicit and lets an instance host more than one.

## For Self-Hosters: It's Opt-In

If you're running BetterShift for yourself, your family, or a single team, you don't need any of this. Multi-tenancy is off by default (`MULTI_TENANT` unset or `false`), and turning it on requires deliberately setting two environment variables plus DNS you control. Leave the "MULTI-TENANCY" section of `.env.example` commented out and nothing about your instance changes.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `MULTI_TENANT` | No (default `false`) | Turns on subdomain-per-workspace routing. |
| `TENANT_BASE_DOMAIN` | Yes, when `MULTI_TENANT=true` | The domain workspaces live under, e.g. `bettershift.example`. A workspace with slug `acme` is served at `acme.bettershift.example`. |
| `TENANT_MAX_WORKSPACES_PER_USER` | No (default `3`) | Workspaces a single user may own. Instance admins (`admin`/`superadmin`) are exempt. |
| `TENANT_RESERVED_SLUGS` | No | Comma-separated extra reserved subdomains, on top of the built-in list and the `bs-pr-*` PR-preview prefix — e.g. hosts you already use on the same DNS zone. |

`TENANT_BASE_DOMAIN` must be a domain dedicated to BetterShift. The proxy trusts every host under it as a valid workspace host (and it feeds better-auth's trusted-origins wildcard), so anything else sharing that domain — another app, a wildcard DNS entry you didn't intend — would be treated as trusted too. It must also differ from `PREVIEW_DOMAIN` if you run PR previews against the same DNS zone; the two serve different purposes and mixing them would let a preview deployment collide with a real workspace slug.

Bind the server to `0.0.0.0` (the Docker image's default `HOSTNAME`) or a non-loopback address, never `HOSTNAME=127.0.0.1` or `::1`. Next.js reports a loopback bind address to the proxy as `localhost`, and then treats the proxy's internal rewrites (the "workspace not found" and "no workspace" pages) as external and fails them with a 500. Redirects and API routes are not affected; this is Next.js behavior, not something BetterShift can work around from inside the proxy.

`MULTI_TENANT=true` requires `AUTH_ENABLED=true`. Without accounts there's no way to know which workspace a request belongs to, and the backwards-compatible "everyone is owner" behavior of `AUTH_ENABLED=false` would otherwise leak every workspace's data to every visitor. A misconfiguration here — `MULTI_TENANT=true` with `AUTH_ENABLED=false`, `MULTI_TENANT=true` without a usable `TENANT_BASE_DOMAIN`, or a `BETTER_AUTH_URL` that isn't a valid portal (see below) — fails closed: the instance treats itself as unhealthy and sends every request to `/system-unavailable` rather than silently serving requests without isolation. `docker compose`'s health check still works in this state — it probes `/api/health` on `localhost`, which is exempt from tenancy resolution and answers using the database connection alone.

## The Portal: `BETTER_AUTH_URL` and OAuth Callbacks

The **portal** is where sign-in, registration and OAuth callbacks live; a workspace's `/login` and `/register` redirect there and come back afterwards. The portal is simply the host of `BETTER_AUTH_URL`, and it can take one of two shapes:

| `BETTER_AUTH_URL` | Portal | Bare base domain |
| --- | --- | --- |
| `https://<TENANT_BASE_DOMAIN>` | the base domain itself | is the portal |
| `https://app.<TENANT_BASE_DOMAIN>` | a subdomain | not served (404) |

Use the subdomain form when the base domain itself can't point at BetterShift — for example because your tunnel or DNS setup only covers `*.<TENANT_BASE_DOMAIN>`, or because the base domain already hosts a website. The portal subdomain must be exactly one label below the base domain and one of the reserved slugs (`app`, `auth`, `portal`, … — see `lib/workspace-slugs.ts`), so no workspace can ever claim it. Anything else — a non-reserved label, two levels down, a host outside the base domain — is a configuration error, and the instance fails closed as described above.

`BETTER_AUTH_URL` is the one fixed URL better-auth uses to build callback URLs, so every OAuth provider (Google, a custom OIDC provider, etc.) is configured with a single callback pinned to the portal origin — `<BETTER_AUTH_URL>/api/auth/callback/<provider>` — regardless of which workspace subdomain a user actually started the sign-in from. Don't register a separate OAuth app or callback per workspace; there is only one, on the portal.

The session cookie is always scoped to `TENANT_BASE_DOMAIN`, so a sign-in on the portal is valid on every workspace subdomain in either shape.

## How a Request Resolves to a Workspace

The workspace for a request comes from the `Host` header alone, resolved in `lib/workspace.ts`, and nowhere else:

- It is never taken from a client-supplied header, a query parameter, or the better-auth session's `activeOrganizationId` (that field exists because the `organization` plugin expects the column, but the session cookie is shared across every workspace subdomain, so trusting it would let a user carry one workspace's session into another).
- `resolveCalendarAccess()` and `findCalendarInWorkspace()` are the single choke point downstream: a calendar (or any resource reached through it) outside the request's workspace is treated as if it doesn't exist — a 404, never a 403 — so a foreign workspace's data can't even be confirmed to exist.
- Outside a request (background jobs, scripts), there is no `Host` header to read. `getRequestWorkspace()` throws if called there; that code must be passed a `workspaceId` explicitly instead. External calendar sync is the existing example — `syncExternalCalendar()` passes the synced calendar's own workspace id into its permission checks, so the auto-sync service can call it outside any request.
- `allowGuestAccess(workspaceId?)` follows the same rule: called during a request it resolves the workspace itself, but a caller outside request scope must pass one.

An unrecognized subdomain under `TENANT_BASE_DOMAIN` renders `/workspace-not-found`; a signed-in user visiting a real workspace subdomain they don't belong to sees the in-app "no access" state instead (they have an account, just not membership here) and can ask an admin or existing member for an invitation.

For public calendars, such a non-member is treated exactly like an anonymous guest: they can discover, subscribe to and open a workspace's public calendars only while that workspace allows guest access. Members keep seeing and subscribing to public calendars regardless of the guest-access setting.

## Onboarding: Creating and Joining a Workspace

The portal's `/` shows the signed-in user's "My workspaces" overview: every workspace they belong to, a button to create a new one, and a field to paste an invite link. It is reached via proxy rewrites from `app/portal/**`, the same way `/login` and `/register` are — there is no separate landing route.

**Creating a workspace** happens at `/new` on the portal. A user picks a name and a slug (auto-suggested from the name, editable, checked live against `GET /api/workspaces/slug-availability`); the slug must be 3–32 characters, match `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`, and not be reserved. Reserved means the built-in list in `lib/workspace-slugs.ts` (portal/infra subdomains such as `app`, `auth`, `admin`, `default`, …), the `bs-pr-*` PR-preview prefix, and anything listed in `TENANT_RESERVED_SLUGS`. The slug is immutable once the workspace exists — it is the subdomain. A user may own at most `TENANT_MAX_WORKSPACES_PER_USER` workspaces (default 3); instance admins are exempt. The creator becomes the workspace's owner. Workspace creation is rate-limited per user (`workspace-create`, default 5/hour) and the slug check separately (`slug-check`, default 60/minute).

**Joining a workspace** happens only through an invite link — see below. `organization/invite-member` and `organization/accept-invitation` are disabled along with the rest of the organization plugin's HTTP surface (see [Disabled Organization Plugin Endpoints](#disabled-organization-plugin-endpoints)).

Login and registration keep a `returnUrl` across the portal so a user who followed an invite link or a workspace-subdomain redirect lands back where they started once they've authenticated.

## Invite Links

A workspace owner or admin creates invite links from the workspace sheet's "Invite links" tab (`components/workspace-sheet.tsx`). Each link (`workspace_join_links` table, migration `0036`) has:

- an **expiry**: never, or 1/7/30 days from creation;
- a **max-use count**: unlimited, or a fixed number (the UI offers presets — 1, 5, 10, 25, 50, 100 — while the API accepts any integer 1–1000);
- a **revoke** action, which invalidates it immediately.

An expired, exhausted, revoked or unknown token all produce the same "invalid link" response — none of these states leak which one applies. Redeeming a link only ever happens on `POST`; visiting the confirmation page (`GET`) never consumes a use. There is no separate accept step: submitting the join form both confirms and joins in one request. Everyone who joins via a link becomes a plain `member`; links cannot grant `admin`. Join links always resolve to the portal (`/join/<token>`, never a workspace subdomain), since the joining user isn't necessarily signed in yet and the portal is where auth lives. Joining is rate-limited per user (`workspace-join`, default 20/15 min) and link creation separately (`workspace-link-create`, default 20/hour). Audit log entries for join-link actions record the link id only, never the token itself.

## Members

A workspace has three roles:

- `owner` — exactly one, the creator, until ownership transfer ships in a later sub-project;
- `admin` — manages invite links and removes members (including other admins, never the owner); only instance admins can grant it, from the admin panel;
- `member` — everyone who joins via an invite link.

Members and invite links are managed from the workspace sheet in the user menu; a workspace switcher there lists every workspace the signed-in user belongs to plus an "All workspaces" entry.

**Leaving or being removed** (self-leave, owner/admin removing another member, or an instance admin removing someone) all go through the same `endMembership()` in `lib/workspace-membership-end.ts`:

- the user's calendar shares, feed tokens and subscriptions on this workspace's calendars are deleted;
- any calendars they owned are transferred to the workspace owner, and the new owner's now-redundant share/subscription rows on those calendars are dropped so they don't see their own calendar as "dismissed";
- the membership row itself is removed.

The **owner cannot leave and cannot be removed** by anyone, including instance admins, until ownership transfer exists. `resolveCalendarAccess()` and `getUserAccessibleCalendars()` ignore calendar ownership and shares of users who are not (or no longer) members of the workspace — ending a membership is what actually revokes access, not just the UI hiding it. For the same reason a signed-in non-member cannot create a calendar in a workspace (`POST /api/calendars` answers 403, and the "create calendar" action is hidden).

## Instance Admins

From a user's details in the admin panel, an instance admin can add that user to a workspace by slug (as `member` or `admin`) or remove them from any workspace they don't own. This is the same `endMembership()` path as a self-service leave/remove. The API is `GET`/`POST`/`DELETE /api/admin/users/[id]/workspaces`, gated on `canManageWorkspaceMemberships` (`lib/auth/admin.ts`); adding and removing additionally require `canEditUser`, so an `admin` cannot change the memberships of another admin or a superadmin.

## Disabled Organization Plugin Endpoints

Every better-auth `/organization/*` HTTP path (`accept-invitation`, `create`, `invite-member`, `remove-member`, `update`, `leave`, …) is listed in `disabledPaths` in `lib/auth.ts`, in both single- and multi-tenant mode. All membership and workspace mutations go exclusively through BetterShift's own routes (`lib/workspaces.ts`, `lib/workspace-join-links.ts`, `lib/workspace-membership-end.ts`), which apply rate limits, audit logging and the cleanup rules above — the plugin's endpoints would bypass every one of them.

**Deleting users:** instance admins should delete accounts through the admin panel (`DELETE /api/admin/users/[id]`). better-auth's admin-plugin endpoint `/api/auth/admin/remove-user` bypasses BetterShift's checks the same way.

## Out of Scope in This Release

The following are explicitly **out of scope** and planned for later sub-projects:

- Workspace ownership transfer (so an owner can eventually leave)
- A per-workspace admin panel or per-workspace settings UI
- Workspace branding, limits, or slug rename/redirect

## Verifying Isolation

`scripts/tenant-isolation-check.ts` (`npm run test:tenancy`) is an executable regression check: it seeds two workspaces directly via Drizzle and makes real HTTP requests across them, asserting that every cross-workspace lookup 404s rather than leaking existence or data, that the disabled organization plugin paths 404 (Stage 2e), and — via `scripts/tenancy-onboarding-checks.ts` (Stage 4) — the onboarding flow itself: slug validation and reservation, workspace creation and its per-user limit, invite-link creation/expiry/max-uses/revocation, join, and leave/remove membership cleanup. Run it against a disposable database and a real (even if synthetic) `TENANT_BASE_DOMAIN` — the script's own header comment has the exact commands (migrate the throwaway DB, start the standalone server with `MULTI_TENANT=true` and `TENANT_BASE_DOMAIN` set, then run the script, then tear both down). CI runs it against both portal layouts (base domain and `app.<TENANT_BASE_DOMAIN>`) with `TENANT_RESERVED_SLUGS=reserved-by-env` set, to cover the env-reserved-slug path too.
