# Telemetry Guide

This guide documents the anonymous usage telemetry BetterShift can send, field by field, so a self-hoster can decide whether to turn it on without reading the source. It also covers the diagnostics export and every other outbound request the app makes on its own.

## Table of Contents

1. [What This Is](#what-this-is)
2. [Every Field](#every-field)
3. [What Is Never Collected](#what-is-never-collected)
4. [Buckets](#buckets)
5. [Turning It Off](#turning-it-off)
6. [Where It Goes](#where-it-goes)
7. [Other Outbound Requests](#other-outbound-requests)
8. [The Diagnostics Export](#the-diagnostics-export)

---

## What This Is

Telemetry is **opt-in and off by default**. A fresh instance sends nothing until an admin explicitly agrees to it in a one-time consent dialog; declining is a permanent, equally valid answer. When enabled, one payload is sent roughly once a day (with a random 5–30 minute startup delay so a fleet of instances restarting together doesn't all report at the same moment). There is no per-request tracking, no analytics script in the page, and no cookie tied to this — the payload is a single, independently generated snapshot of the instance's own state.

The payload is anonymous in the sense that it carries no names, emails, URLs, or IP addresses (see [What Is Never Collected](#what-is-never-collected)) — it is not anonymous in the sense of being unlinkable to itself: a stable `instanceId` lets repeated pings from the same instance be grouped over time.

If a future release changes what is collected in a way that needs fresh consent, an instance that previously accepted is asked again once (governed by `schemaVersion` — see the field table below); an instance that declined is never re-prompted.

---

## Every Field

This table is generated from `TelemetryPayload` in [`lib/telemetry/schema.ts`](../lib/telemetry/schema.ts) — every field the type defines appears below, and nothing else does. Fields under `scale` are size buckets, not exact counts (see [Buckets](#buckets)); the [diagnostics export](#the-diagnostics-export) is the only path that ever carries exact numbers, and only on admin request.

| Field | Example | Answers |
| --- | --- | --- |
| `schemaVersion` | `1` | Which version of this payload's shape was used, so a schema change can be handled or ignored correctly. |
| `instanceId` | `"3f2a9c11-8b7d-4e2a-9c31-7a5e6d2b9f01"` or `null` | A random id generated once, the first time telemetry is turned on, so repeated pings from the same instance can be grouped. `null` before an instance has ever opted in. |
| `sentAt` | `"2026-09-19T14:32:07.512Z"` | When this specific payload was generated. |
| `app.version` | `"3.2.0"` | Which release is running. |
| `app.isDev` | `false` | Is this a development build (a dev build never actually sends, but the admin preview still shows what it would look like). |
| `app.migrations` | `42` | How many database migrations have been applied — a rough signal of how current the schema is. |
| `runtime.node` | `"24.4.0"` | Which Node.js version the process is running on. |
| `runtime.arch` | `"x64"` | Which CPU architecture (`x64`, `arm64`, …). |
| `runtime.platform` | `"linux"` | Which OS family the process runs on. |
| `runtime.sqlite` | `"3.45.1"` | Which SQLite version the database driver reports. |
| `runtime.timezone` | `"Europe/Berlin"` or `"unknown"` | The value of the `TZ` environment variable, if set. |
| `config.authEnabled` | `true` | Is authentication turned on for this instance. |
| `config.guestAccess` | `false` | Is guest (no-login) access allowed. |
| `config.registrationOpen` | `true` | Can new users self-register. |
| `config.defaultLocale` | `"de"` | Which locale the instance defaults to. This is the instance-wide default only — there is deliberately no per-user locale field, because nothing in the app stores one per account. |
| `config.updateCheckEnabled` | `true` | Has this admin turned off the update check described in [Other Outbound Requests](#other-outbound-requests). |
| `config.rateLimitOverrides` | `2` | How many `RATE_LIMIT_*` environment variables are set — a count only, never which ones or what values. |
| `scale.users` | `"6-20"` | Roughly how many user accounts exist. |
| `scale.calendars` | `"1-5"` | Roughly how many calendars exist. |
| `scale.shifts` | `"101-500"` | Roughly how many shifts exist. |
| `scale.presets` | `"6-20"` | Roughly how many shift presets exist. |
| `scale.notes` | `"1-5"` | Roughly how many calendar notes/events exist. |
| `scale.bundles` | `"6-20"` | Roughly how many permission bundles exist across all calendars. |
| `scale.shares` | `"1-5"` | Roughly how many calendar shares (invited users) exist. |
| `scale.accessTokens` | `"0"` | Roughly how many share links (access tokens) exist. |
| `scale.signups` | `"1-5"` | Roughly how many shift signups exist. |
| `features.externalSyncs` | `"0"` | Roughly how many external calendar subscriptions are configured — never which calendars they sync to or their URLs. |
| `features.calendarViewOverrides` | `"1-5"` | Roughly how many calendars pin their own view settings instead of using each viewer's personal one. |
| `features.customFields.count` | `"1-5"` | Roughly how many custom field definitions exist across all calendars. |
| `features.customFields.types` | `["text", "select"]` | Which custom field *types* are in use — never a field's key or label (see [What Is Never Collected](#what-is-never-collected)). |
| `features.archivedPresets` | `true` | Does at least one archived preset exist. |
| `features.splitShifts` | `false` | Does at least one calendar have split shifts enabled. |
| `health.uptimeHours` | `168` | How many hours since the Node process last (re)started. |
| `health.syncRuns24h` | `12` | How many external sync runs completed in the last 24 hours. |
| `health.syncFailures24h` | `0` | How many of those runs failed. |

---

## What Is Never Collected

Regardless of what's enabled, the payload never contains:

- External sync URLs — they can reveal an employer or organization.
- Calendar, shift, or note names/content.
- Custom field keys or labels — only the field *types* (see `features.customFields.types` above).
- User names.
- Email addresses.
- IP addresses.
- The instance's hostname or domain.

---

## Buckets

Every count under `scale` and `features.externalSyncs` / `features.calendarViewOverrides` / `features.customFields.count` is reported as one of six size buckets instead of an exact number, via `toBucket()` in `lib/telemetry/schema.ts`:

| Bucket | Range |
| --- | --- |
| `0` | Exactly zero. |
| `1-5` | 1 to 5. |
| `6-20` | 6 to 20. |
| `21-100` | 21 to 100. |
| `101-500` | 101 to 500. |
| `500+` | More than 500. |

The comment in the source is explicit about why: an exact count can make a small instance recognisable (e.g. "exactly 3 users"); a bucket answers the same scale question without doing so.

---

## Turning It Off

Three independent controls, in order of precedence:

1. **`TELEMETRY_ENABLED=false`** in `.env` — a hard off. It wins over any stored answer, including a previous "yes": no consent dialog is shown, no daily send ever fires, and the admin toggle described below is disabled (shown as environment-managed). This is the setting for an unattended or scripted deployment where telemetry must never be a question.
2. **`TELEMETRY_ENABLED=true`** — the mirror image: a hard on. It also skips the dialog and disables the admin toggle, and wins over a stored "no".
3. **The admin toggle** (Admin → System Settings) — only reachable when `TELEMETRY_ENABLED` is unset in the environment. This is what the one-time consent dialog writes to, and it can be flipped again at any time afterwards.

Only the literal values `true` and `false` are recognised. Anything else (`1`, `yes`, `TRUE`, …) is treated as `false` — a hard off that also disables the admin toggle — so a typo fails closed rather than silently turning telemetry on.

`TELEMETRY_ENDPOINT` (default `https://telemetry.bettershift.app/`) lets you point the daily send at your own receiver instead — useful if you'd rather run [`telemetry-hub/`](../telemetry-hub/) yourself, or something else entirely that accepts the same JSON body.

---

## Where It Goes

The default endpoint is a small Cloudflare Worker; its source lives in this repository at [`telemetry-hub/`](../telemetry-hub/) (excluded from the Docker image — it's deployed separately, not run alongside the app). It:

- Accepts only `POST` requests up to 16 KB.
- Validates the payload against the current schema version (`telemetry-hub/src/schemas/v1.ts`). A body that isn't valid JSON is answered with `400` and one larger than 16 KB with `413`; a payload that parses but fails validation, or carries an unknown/retired `schemaVersion`, is answered with `200` and discarded. Either way the fire-and-forget sender ignores the status and never retries.
- Forwards a valid payload to [PostHog](https://posthog.com/) (`telemetry-hub/src/targets/posthog.ts`), explicitly enumerating each field it passes on rather than forwarding the request body as-is, so an unexpected extra field can never leak through.
- Sends `$ip: null` and `$geoip_disable: true` with every event, so PostHog neither stores the request IP nor derives a country or city from it — without this, the Cloudflare PoP nearest the sending instance would approximate its location.
- **Stores nothing itself.** There is no database, no request log, and no persistence layer in the Worker — a payload it can't forward to PostHog is simply lost, not queued or written anywhere.

---

## Other Outbound Requests

Telemetry is not the only request BetterShift makes on its own. Independently of telemetry — and regardless of whether telemetry is enabled — `/api/version` (and the release list behind `/api/releases`) polls the public GitHub releases API for this project on a 15-minute server-side cache, to show admins whether a newer version is available.

This has existed before telemetry was added and is controlled separately: the **"Check for updates"** switch in Admin → System Settings (`updateCheckEnabled`) turns it off. With it off, no request to GitHub is made. Note that `config.updateCheckEnabled` in the telemetry payload only reports whether this switch is on — it does not send anything from the GitHub response itself.

---

## The Diagnostics Export

Separately from the daily telemetry send, Admin → System Settings has a **diagnostics export**: an admin-triggered preview that can be copied or used to pre-fill a GitHub issue.

- It carries the same shape as the telemetry payload, but with **exact numbers** instead of buckets (`scale` and the numeric parts of `features` are plain counts), plus two fields the telemetry payload never has: `envFlags`, the values of a fixed allowlist of environment variables (`AUTH_ENABLED`, `ALLOW_GUEST_ACCESS`, `ALLOW_USER_REGISTRATION`, `DEFAULT_LOCALE`, `TZ`, `TELEMETRY_ENABLED` — see `REPORTABLE_ENV` in `lib/telemetry/collect.ts`, never `process.env` as a whole), plus `TELEMETRY_ENDPOINT`, which is reported as `"custom"` or `"default"` and never as its actual value — a self-hosted receiver URL can be private and carry a token, and this export is meant for public issues, and `migrationList`, the list of applied migration hashes.
- It works **whether or not telemetry is enabled** — it's a local, on-demand preview, never sent anywhere automatically. Only pressing "copy" or "open issue" puts it anywhere, and that's the admin's own action, to their own clipboard or their own browser tab to GitHub.
- `instanceId` is included in the exported/copied diagnostics only when telemetry is enabled **and** the admin leaves the separate "include instance id" switch on next to the export. With telemetry off, or that switch off, `instanceId` is reported as `null` in the export regardless of what's stored.
