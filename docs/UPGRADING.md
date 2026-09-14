<!--
Maintainer note: this file collects breaking changes across releases, newest first.

When a release has breaking changes, add a new section above the previous one:

  ## X.Y.Z (from previous version)

  Reuse the same subsections, each suffixed with the version so anchors stay
  unique across releases instead of colliding (GitHub would otherwise render
  the second "Breaking Changes" heading in the file as "#breaking-changes-1"):

  ### Before You Start (X.Y.Z)
  ### Breaking Changes (X.Y.Z)
  ### Upgrade Steps (X.Y.Z)
  ### FAQ (X.Y.Z)
  ### Rollback (X.Y.Z)

  Add the version to the list below. A release with no breaking changes
  doesn't need a full section — a one-line entry in the list is enough.
-->

# Upgrade Guide

Breaking changes between BetterShift releases and the steps to get through them. Find the version you're upgrading from below.

## Versions

- [3.1.0](#310-from-300) — from `3.0.0`
- [3.0.0](#300-from-22x) — from `2.2.x`

---

## 3.1.0 (from 3.0.0)

BetterShift 3.1.0 replaces the fixed calendar read/write/admin permission ladder with per-calendar **permission bundles** — an owner defines named bundles by ticking individual capabilities instead of the app hard-coding what "write" means. See the [Permissions and Sharing Guide](PERMISSIONS.md) for the full picture. The upgrade itself needs no configuration changes; there's a single deliberate behavior change to be aware of, described below.

### Before You Start (3.1.0)

**Prerequisites**

- A BetterShift instance running `3.0.0`
- Database backup (recommended) — this migration rewrites the permission tables and is not cleanly reversible in place

```bash
# SQLite database location (default)
cp ./data/sqlite.db ./data/sqlite.db.backup

# Or if using Docker
docker cp bettershift:/app/data/sqlite.db ./sqlite.db.backup
```

The migration replaces the old `read`/`write`/`admin` enum columns on shares, tokens, and calendars with permission bundle rows, mapping every existing calendar's shares, links, and guest access onto equivalent bundles — see [Breaking Changes](#breaking-changes-310) for the one place where "equivalent" isn't identical.

### Breaking Changes (3.1.0)

#### 1. Guest and link access can no longer manage external sync

This is the one deliberate behavior change for existing calendars. The old `write` tier is split into two new bundles: **Contribute** (create shifts/presets, edit your own entries — no external sync) and **Manage** (adds editing anyone's entries, still no external sync). The migration maps a calendar's `write` guest access or share links onto Contribute, and — specifically for guest/link access, not for invited users — strips `manageExternalSync` and `deleteSyncLogs` out of what it grants, even though those capabilities were part of the old `write` tier. A user invited directly (`calendarShares`, not guest/link) keeps exactly their previous capabilities, external sync management included; only guest and link access lose it.

This isn't an incidental migration side effect — external sync configuration touches credentials and arbitrary URLs, and guest/link access is now hard-locked out of it at the enforcement layer, not just by the migrated defaults. No bundle assigned to guest access or a link can ever hold `manageExternalSync`/`deleteSyncLogs`, regardless of what an owner ticks into it afterwards.

| Your setup | Action |
| --- | --- |
| No calendar ever had guest access or a share link set to `write` | No action |
| A calendar's guest access or a share link was `write`, and you relied on that to manage external sync | Re-check your sync setup after upgrading — see [FAQ](#faq-310) |

#### 2. Everything else keeps its prior effective permissions

Every existing calendar's owner, shares (`read`/`write`/`admin`), and guest/link access (`none`/`read`/`write`) are mapped 1:1 onto the new bundle system — nobody gains or loses access as part of this upgrade, aside from the external-sync change above. The improved defaults introduced alongside bundles (for example, the Read bundle now granting self-signup out of the box) only apply to calendars created after upgrading, not retroactively to existing ones.

### Upgrade Steps (3.1.0)

1. **Back up your database** (see [Before You Start](#before-you-start-310)).
2. **Pull the new image** (`ghcr.io/pantelx/bettershift:latest` or `:3.1.0`).
3. **Restart the container** (or `npm run build && npm run db:migrate && npm start` from source). The migration runs automatically on container start.
4. **If any calendar's guest access or a share link was previously `write`**: open that calendar's Permissions settings and confirm whether external sync management is still needed there — see [Breaking Change 1](#1-guest-and-link-access-can-no-longer-manage-external-sync).

### FAQ (3.1.0)

**Do I need to change anything in `.env` for this release?**

No. This release has no new environment variables and no required configuration change — the migration runs automatically, and the one behavior change above is informational rather than an action every instance needs to take.

**A guest or a link used to manage my external calendar sync. What do I do now?**

Guest and link access can no longer hold that capability, by design — it touches sync credentials and URLs. Invite the person who needs to manage sync as a regular shared user instead, and assign them a bundle that includes "Manage external sync" (the built-in Admin bundle already does). See [Sharing Calendars](PERMISSIONS.md#sharing-calendars).

**Will my existing shares, links, and guest access still work the same after upgrading?**

Yes, with the one exception above. Every prior `read`/`write`/`admin` share, and every guest/link `read`/`write` setting, maps to an equivalent bundle with the same effective capabilities.

**Do the new default bundles (e.g. self-signup on Read) apply to my existing calendars?**

No. They only apply to calendars created after the upgrade. Existing calendars keep their migrated bundles, which you can still edit like any other bundle.

### Rollback (3.1.0)

1. Re-deploy the `v3.0.0` image tag (or your previous version).
2. Restore the `sqlite.db` backup taken in [Before You Start](#before-you-start-310) — this migration drops the old permission enum columns in place, so an older version cannot read the new bundle tables and a plain image downgrade is not enough on its own.

---

## 3.0.0 (from 2.2.x)

BetterShift 3.0.0 is the redesign release — a new visual design across the calendar, admin panel and sign-in flow — bundled with a handful of infrastructure changes that need action from every self-hosted instance coming from `2.2.x`.

### Before You Start (3.0.0)

**Prerequisites**

- A BetterShift instance running `2.2.0` or `2.2.1`
- Read access to your `.env` file and, for Docker, your `docker-compose.yml` / `docker run` command
- Database backup (recommended)

```bash
# SQLite database location (default)
cp ./data/sqlite.db ./data/sqlite.db.backup

# Or if using Docker
docker cp bettershift:/app/data/sqlite.db ./sqlite.db.backup
```

The only schema change in this release is additive (a new `user_preferences` table and a nullable `calendars.view_settings` column, for the personal/per-calendar view settings feature) — `npm run db:migrate` handles it, no manual data work is needed.

### Breaking Changes (3.0.0)

#### 1. ARM Docker images are no longer built

Releases up to and including `v2.2.1` were published for both `linux/amd64` and `linux/arm64`. Starting with `v3.0.0`, only `linux/amd64` images are built, to keep the image small (the same change also cut the image from 1.01GB to 203MB).

| Your setup                                           | Action                                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Raspberry Pi, Ampere, or another native arm64 server | Stay on `v2.2.1` — it will not receive further updates                                                     |
| Apple Silicon Mac via Docker Desktop                 | Same as above, unless you're fine running `amd64` under emulation (slower, not recommended for production) |
| `linux/amd64` server (the common case)               | No action                                                                                                   |

#### 2. The real client IP behind a reverse proxy must now be configured explicitly

Previous versions used the `@supercharge/request-ip` package, which auto-detected several proxy headers (including Cloudflare's `CF-Connecting-IP`) without configuration. That library is gone; IP detection is now controlled by a single `TRUSTED_PROXY_HEADER` variable, because auto-detection could be fooled by a client sending a fake header of its own.

Rate limiting and audit-log entries are keyed off this address, so getting it wrong doesn't break the app — it silently attributes every visitor to the wrong IP (usually your proxy's own address), which weakens rate limiting and makes the audit log useless for tracing abuse.

Add to `.env`:

| Your setup                                                   | Set `TRUSTED_PROXY_HEADER` to                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Cloudflare in front (with or without Caddy/nginx behind it)  | `CF-Connecting-IP`                                            |
| Caddy, nginx, or Traefik directly in front                   | `X-Real-IP`                                                   |
| No reverse proxy — app exposed directly                      | `none`                                                         |
| Exactly one reverse proxy, header name unknown                | leave unset (falls back to the last `X-Forwarded-For` entry) |

If you were previously behind Cloudflare and didn't need to configure anything for correct IPs, you need to add this now.

#### 3. Stricter Content-Security-Policy — an escape hatch if it breaks your setup

`v2.2.x` shipped `script-src 'self' 'unsafe-inline' 'unsafe-eval'` in production — any inline or externally injected script was allowed. `v3.0.0` switches to a per-request nonce with `'strict-dynamic'` and drops `'unsafe-eval'` outside development. This is new in `v3.0.0`, not a setting you could have touched before.

The stricter policy can block a same-origin script that a reverse proxy injects into the page without your app's nonce — Cloudflare's Rocket Loader is the known case. If the app fails to load or hydrate after upgrading (a blank page, or a page that never becomes interactive) and you use Rocket Loader or a similar script-rewriting proxy feature, set:

```bash
CSP_STRICT_DYNAMIC_BYPASS=true
```

This falls back to the old, permissive `'self' 'unsafe-inline'` policy for scripts. If you don't hit this symptom, no action is needed.

#### 4. Avatar uploads need a second Docker volume

Uploaded profile pictures live at `/app/public/uploads` inside the container. Until now, only `/app/data` was mounted, so avatars were silently lost every time the container was recreated. Add the second mount **before** upgrading:

```diff
 volumes:
   - ./data:/app/data
+  - ./uploads:/app/public/uploads
```

(or `-v ./uploads:/app/public/uploads` for a plain `docker run`). Avatars lost before this fix cannot be recovered from the database; only newly uploaded ones will persist once the mount is in place.

#### 5. Node.js 22+ is required for source installs

Only relevant if you run `npm install` / `npm run build` directly on a host rather than using the Docker image (which already bundles Node 24). Update your local Node.js version before installing.

#### 6. `AUTH_ENABLED` behavior when unset was fixed

The client and server previously disagreed on the default when `AUTH_ENABLED` was left unset: the server treated it as enabled, the client's UI treated it as disabled. This is now consistent (both default to enabled). If your `.env` already sets `AUTH_ENABLED` explicitly, this doesn't affect you; if it was left unset, we recommend setting it explicitly to whatever you intend, so a future default change can't surprise you again.

#### 7. better-auth was updated (1.4.7 → 1.6.30)

If you use a custom OIDC provider, sign in again after upgrading and confirm it still works. See [Authentication Setup](AUTH_SETUP.md) if you need to adjust the configuration.

### Upgrade Steps (3.0.0)

1. **Back up your database** (see [Before You Start](#before-you-start-300)).
2. **Update `.env`** for the items in [Breaking Changes](#breaking-changes-300) that apply to you: `TRUSTED_PROXY_HEADER`, and an explicit `AUTH_ENABLED`. Keep `CSP_STRICT_DYNAMIC_BYPASS` in mind only if step 6 below turns up a blank page.
3. **Add the `uploads` volume mount** to your `docker-compose.yml` or `docker run` command.
4. **Pull the new image** (`ghcr.io/pantelx/bettershift:latest` or `:3.0.0`) — skip this step and stay on `v2.2.1` if you're on ARM hardware.
5. **Restart the container** (or `npm run build && npm run db:migrate && npm start` from source). The migration runs automatically on container start.
6. **Verify**: sign in still works (including OAuth/OIDC if configured), a newly uploaded avatar survives a container restart, and new audit-log entries show real visitor IPs rather than your proxy's address.

### FAQ (3.0.0)

**I don't use a reverse proxy — do I need to set `TRUSTED_PROXY_HEADER`?**

No, but setting it to `none` makes the intent explicit and is slightly more defensive than leaving it unset.

**I'm on ARM hardware. What are my options?**

Stay on `v2.2.1`. It won't receive further updates, but there's no forced-upgrade pressure — running it indefinitely is fine if ARM support matters more than new features.

**The app shows a blank page / never finishes loading after upgrading.**

This is almost always the CSP change interacting with a script-injecting reverse-proxy feature (Cloudflare Rocket Loader is the common case). Set `CSP_STRICT_DYNAMIC_BYPASS=true` and restart.

**My avatars are gone after upgrading.**

Anything uploaded before you added the `./uploads:/app/public/uploads` volume mount was never persisted to disk and can't be recovered. Add the mount (see [Breaking Change 4](#4-avatar-uploads-need-a-second-docker-volume)) so it doesn't happen again.

**Do I need to touch the database manually?**

No. `npm run db:migrate` (or the Docker entrypoint, which runs it automatically) only adds a new table and a new nullable column — no existing data is changed.

### Rollback (3.0.0)

1. Re-deploy the `v2.2.1` image tag (or your previous version).
2. The `v3.0.0` migration is additive, so an older version simply ignores the new table/column — no database rollback is needed.
3. `TRUSTED_PROXY_HEADER` and `CSP_STRICT_DYNAMIC_BYPASS` can stay in your `.env` — `v2.2.1` doesn't read either and ignores them.
