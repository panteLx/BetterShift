# Multi-Tenancy Guide

This guide explains BetterShift's optional multi-tenant mode: one running instance serving several isolated workspaces, each reachable on its own subdomain.

## Table of Contents

1. [What a Workspace Is](#what-a-workspace-is)
2. [For Self-Hosters: It's Opt-In](#for-self-hosters-its-opt-in)
3. [Environment Variables](#environment-variables)
4. [The Portal: `BETTER_AUTH_URL` and OAuth Callbacks](#the-portal-better_auth_url-and-oauth-callbacks)
5. [How a Request Resolves to a Workspace](#how-a-request-resolves-to-a-workspace)
6. [Creating a Workspace](#creating-a-workspace)
7. [Out of Scope in This Release](#out-of-scope-in-this-release)
8. [Verifying Isolation](#verifying-isolation)

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

## Creating a Workspace

This core release has no self-service signup flow. An instance admin creates a workspace through better-auth's `organization` API (`POST /api/auth/organization/create`, or `auth.api.createOrganization` from a small admin script) with a chosen slug and name. The slug must match `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$`, must not be reserved (`lib/workspace-slugs.ts`), and is immutable afterwards — `organization/update` refuses any request that carries a `slug`, since it is the workspace's subdomain.

Members join over HTTP by invitation: a workspace owner or admin calls `organization/invite-member`, and the invitee accepts with `organization/accept-invitation` (their email must be verified). better-auth's `addMember` is server-only — usable from an admin script via `auth.api.addMember`, not as an HTTP endpoint. There is no workspace-creation or invitation UI yet — see the next section.

**Deleting users:** instance admins should delete accounts through the admin panel (`DELETE /api/admin/users/[id]`). better-auth's admin-plugin endpoint `/api/auth/admin/remove-user` bypasses BetterShift's checks — it would remove the sole owner of a workspace that still has other members, and it leaves a workspace behind with no members at all instead of cleaning it up.

## Out of Scope in This Release

Multi-tenancy today is deliberately just the isolation core. The following are explicitly **out of scope** and planned for later sub-projects:

- Self-service workspace creation (a portal/landing page with slug choice)
- An invitations UI
- A workspace switcher UI for users who belong to more than one workspace
- A per-workspace admin panel or per-workspace settings UI
- Workspace branding, limits, or slug rename/redirect

Until those ship, workspace management is an operator task performed directly against better-auth's `organization` tables/API.

## Verifying Isolation

`scripts/tenant-isolation-check.ts` (`npm run test:tenancy`) is an executable regression check: it seeds two workspaces directly via Drizzle and makes real HTTP requests across them, asserting that every cross-workspace lookup 404s rather than leaking existence or data. Run it against a disposable database and a real (even if synthetic) `TENANT_BASE_DOMAIN` — the script's own header comment has the exact commands (migrate the throwaway DB, start the standalone server with `MULTI_TENANT=true` and `TENANT_BASE_DOMAIN` set, then run the script, then tear both down).
