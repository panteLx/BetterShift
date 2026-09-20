# BetterShift Telemetry Hub

A small Cloudflare Worker that receives the opt-in, anonymous instance pings of BetterShift and stores them in a [Cloudflare D1](https://developers.cloudflare.com/d1/) database. Reports are plain SQL, run from the command line.

You only need this if you want to **run your own receiver**. By default, instances send to the maintainer's hub, and an admin can opt out completely. What is sent is documented field by field in [`docs/TELEMETRY.md`](../docs/TELEMETRY.md).

The hub is deployed on its own and is not part of the Docker image.

## Table of Contents

1. [What You Need](#what-you-need)
2. [Set It Up](#set-it-up)
3. [Point Your Instances at It](#point-your-instances-at-it)
4. [Test It Locally](#test-it-locally)
5. [What the Worker Does](#what-the-worker-does)
6. [The Public Statistics Page](#the-public-statistics-page)
7. [Reading the Data](#reading-the-data)
8. [Operating It](#operating-it)
9. [Project Layout](#project-layout)

---

## What You Need

- A **Cloudflare account** (the free plan is enough — see [Cost](#cost)).
- **Node.js 20.12 or newer** on the machine you deploy from.
- Optional: a domain on Cloudflare, if you want a URL like `telemetry.example.com`. Without one, the Worker is served from a free `*.workers.dev` address.

There is no third-party service and no API key anywhere in this project.

## Set It Up

All commands run in this directory (`telemetry-hub/`).

### 1. Install

```bash
npm install
npx wrangler login
```

### 2. Create the database

```bash
npx wrangler d1 create bettershift-telemetry
```

Wrangler prints a `database_id`. Paste it into the `[[d1_databases]]` block in `wrangler.toml`, replacing `REPLACE_WITH_YOUR_DATABASE_ID`. The id is not a secret and belongs in the file.

### 3. Adjust `wrangler.toml`

The committed file describes the maintainer's deployment. Change it before your first deploy:

| Setting         | What to do                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`          | Any unique Worker name.                                                                                                                                     |
| `routes`        | Replace `pattern` and `zone_name` with your own hostname and the Cloudflare zone it belongs to. Cloudflare creates the DNS record and certificate for you. |
| `database_id`   | From step 2.                                                                                                                                                |
| `database_name` | Only if you named the database something else. It also has to match the name in the `migrate` scripts in `package.json`.                                    |
| `binding`       | Leave it alone unless you also change the matching key in `Env` in `src/index.ts`. A mismatch is silent: the Worker still answers `200` and drops the ping.  |

No domain? Delete the whole `routes` block and add `workers_dev = true` instead. After the deploy, Wrangler prints the `https://<name>.<your-subdomain>.workers.dev` URL.

### 4. Create the table

```bash
npm run migrate
```

This applies everything in `migrations/` to the deployed database. Run it again after adding a migration; already-applied ones are skipped — that includes `migrations/0002_create_aggregates.sql`, added for the public statistics page below, so `npm run migrate` needs a second run on a database that was already set up before it existed.

### 5. Deploy

```bash
npm run deploy
```

### 6. Check that it arrived

Send one valid ping with an id you can recognise later:

```bash
curl -i -X POST https://YOUR-HUB-URL \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":1,"instanceId":"smoke-test","sentAt":"2026-01-01T00:00:00.000Z","app":{"version":"0.0.0","isDev":true,"migrations":0},"runtime":{"node":"24.0.0","arch":"x64","platform":"linux","sqlite":"3.45.1","timezone":"UTC"},"config":{"authEnabled":true,"guestAccess":false,"registrationOpen":false,"defaultLocale":"en","updateCheckEnabled":true,"rateLimitOverrides":0},"scale":{"users":"1-5","calendars":"1-5","shifts":"1-5","presets":"0","notes":"0","bundles":"0","shares":"0","accessTokens":"0","signups":"0"},"features":{"externalSyncs":"0","calendarViewOverrides":"0","customFields":{"count":"0","types":[]},"archivedPresets":false,"splitShifts":false},"health":{"uptimeHours":1,"syncRuns24h":0,"syncFailures24h":0}}'
```

You should get `HTTP/2 200`, and the ping should show up in:

```bash
npm run stats -- recent
```

**A `200` alone proves nothing.** The Worker also answers `200` to payloads it discards and to failed writes, on purpose (see [What the Worker Does](#what-the-worker-does)). The row is the real confirmation.

## Point Your Instances at It

Set this in the `.env` of every BetterShift instance that should report to you:

```env
TELEMETRY_ENDPOINT=https://YOUR-HUB-URL
```

Use the bare URL without a path. Telemetry itself stays opt-in: the instance admin still has to agree in the app, or you set `TELEMETRY_ENABLED=true` to switch it on for a deployment you control. Details are in [`docs/TELEMETRY.md`](../docs/TELEMETRY.md#turning-it-off).

## Test It Locally

```bash
npm run migrate:local
npm run dev
```

The Worker then listens on `http://localhost:8787` against a local SQLite file under `.wrangler/` — nothing touches the deployed database. Use the `curl` command from step 6 against that URL, then:

```bash
npm run stats -- --local
```

To check the public page and `/data.json` without sending pings by hand, seed deterministic fixture data instead:

```bash
npm run seed:local -- --reset
```

This deletes all local pings and inserts a fixed set of instances, never against `--remote`. `npx wrangler dev --test-scheduled` lets you then trigger the hourly cron by hand (`curl "http://localhost:8787/__scheduled?cron=17+*+*+*+*"`) to compute the aggregate from the seeded rows, and reload `/` or `/data.json` to see it.

`npm run typecheck` checks the types.

## What the Worker Does

Routing resolves the path first, then the method:

| Request                                | Answer                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /`                                | The public statistics page (HTML).                                                 |
| `GET /data.json`                       | The same statistics as JSON.                                                        |
| `POST /`                                | Ingest — validated and written to D1, see below.                                    |
| Any other path                         | `404`                                                                               |
| A known path with the wrong method     | `405` (e.g. `PUT /`, or `POST /data.json`)                                          |

For `POST /` specifically:

| Request                                              | Answer                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Body larger than 16 KB                               | `413`                                                                                    |
| Body is not valid JSON                               | `400`                                                                                    |
| Valid JSON that fails validation, or unknown version | `200`, discarded                                                                         |
| Valid v1 payload                                     | `200`, written to D1. If the write fails, still `200`; the error message is logged.      |

The senders are fire-and-forget and never retry, so a payload the Worker cannot write is lost. That is by design: there is no queue and no request log.

Each field is written to its own column explicitly; nothing is spread from the request body, so an unexpected extra field cannot reach the database. The Worker never reads the connecting IP, and no column holds one — the stored `received_at` is the Worker's own clock, because the instance's `sent_at` can be skewed.

Cloudflare itself still sees the connecting IP in its own edge logs, like for any hosted Worker.

Rows are kept indefinitely. There is no expiry job: at one ping per instance per day the table stays small for years (see [Cost](#cost)).

## The Public Statistics Page

`GET /` renders an HTML page — and `GET /data.json` the same data as JSON — from a single precomputed row in the `aggregates` table, so the read path never touches `instance_pings` (`src/aggregate.ts`, `src/page.ts`). A `[triggers]` cron in `wrangler.toml` (`17 * * * *`, off the hour on purpose) recomputes that row once an hour by running `buildAggregate()` and replacing it wholesale via `storeAggregate()` — a run in progress never leaves a partially updated page. Until the first cron run after deploy, the page shows a neutral empty state.

The aggregate only ever holds counts and shares grouped across instances: no instance id, no raw row, no per-instance timestamp appears in it, and `/data.json` is served with `Access-Control-Allow-Origin: *` since it carries nothing that needs to stay private to a caller. What exactly is published, including the fact that there is no small-group threshold, is documented in [`docs/TELEMETRY.md`](../docs/TELEMETRY.md#where-it-goes).

## Reading the Data

Every report in `queries/` is a plain SQL file. Run them all, or by name:

```bash
npm run stats                     # every report
npm run stats -- versions sizes   # just these two
npm run stats -- --local          # against the local database
```

| Report               | What it answers                                                    | Window                    |
| -------------------- | ------------------------------------------------------------------ | ------------------------- |
| `instances-daily`    | How many instances reported per day                                | All history                |
| `instances-new`      | New installs per day (first time an instance id was seen)          | All history                |
| `versions`           | Which app versions are in use                                      | Last 30 days               |
| `environment`        | Node, platform, arch, SQLite and timezone distribution             | Last 30 days               |
| `configuration`      | Auth, guest access, registration, locale, update check             | Last 30 days               |
| `sizes`              | Instance size buckets across users, calendars, shifts, …           | Last 30 days               |
| `features`           | Feature adoption                                                   | Last 30 days               |
| `custom-field-types` | Which custom field types are actually used                         | Last 30 days               |
| `health`             | Uptime and external-sync failures                                  | Last 30 days               |
| `recent`             | The last 25 raw pings                                              | All history                |

Distribution reports (`versions`, `environment`, `configuration`, `sizes`, `features`, `custom-field-types`, `health`) read the `latest_pings` view — one row per instance, its newest ping — bounded to instances whose newest ping is within the last 30 days, the same window `src/aggregate.ts` uses for the public page and `/data.json`. That keeps the reports and the page describing the same population instead of quietly diverging (an instance that stopped reporting 90 days ago drops out of both at once). `instances-daily`, `instances-new` and `recent` are genuinely historical or raw and stay unbounded, reading `instance_pings` directly.

For anything ad hoc:

```bash
npx wrangler d1 execute bettershift-telemetry --remote \
  --command "SELECT app_version, COUNT(*) FROM latest_pings GROUP BY app_version"
```

The `queries/` reports and this ad-hoc SQL run against the raw `instance_pings` table and need `wrangler` access to the database. The public page at `GET /` and `GET /data.json` (see [The Public Statistics Page](#the-public-statistics-page)) is the equivalent view for anyone without that access — it needs no credentials because it never touches `instance_pings` directly, only the hourly precomputed aggregate.

## Cost

Everything here fits in the Cloudflare free plan, which covers 100,000 D1 row writes and 5 million row reads per day and 5 GB of storage. One instance writes one row per day, and a row is roughly 300 bytes — a hundred instances reporting daily for a year is about 36,000 rows, some 11 MB, well inside the write limit.

Reads are a separate budget, and the hourly cron is what spends it, not the writes above. `buildAggregate()` (`src/aggregate.ts`) resolves `latest_pings` — each instance's newest ping — once per run, then computes every breakdown (versions, environment, configuration, sizes, features, custom field types, health) from that one filtered, materialized set instead of re-deriving it per breakdown.

A run scans the ping history three times in total: once to materialize that set, once for `newLast30Days`, which needs each instance's *first* ping rather than its newest, and once for the 90-day history series. At the 36,000-row example above that is on the order of 80,000 rows per run, so 24 runs a day come to roughly **1.9M rows/day** — inside the 5M/day limit, but not by a margin worth spending carelessly.

Querying `latest_pings` independently for each of those seven breakdowns instead — as an earlier version of this query did — reads the full ping history again every time: roughly 9× per run, about 7.8M rows/day at the same example, over the free-tier read limit with no warning beyond the cron silently failing. `EXPLAIN QUERY PLAN` on `buildAggregate()`'s query shows a single `MATERIALIZE active` step feeding every breakdown, which is what keeps this bounded as the ping history grows. That `MATERIALIZED` hint is load-bearing: without it SQLite inlines the CTE per reference and the nine-scan behaviour returns silently, with identical results.

Since 1 September 2026 Cloudflare returns errors on free accounts that exceed the daily row limits instead of billing for them, so the plan cannot turn into a surprise invoice.

## Operating It

- **Live logs:** `npx wrangler tail`. A failed write appears as one line with the error message, never the payload.
- **Nothing shows up:** check, in this order, that the ping reached the Worker (`wrangler tail` while sending), that `npm run migrate` has been run against the deployed database, and that the sender is a real v1 payload (an invalid one is discarded silently).
- **Deleting an instance's data:** `npx wrangler d1 execute bettershift-telemetry --remote --command "DELETE FROM instance_pings WHERE instance_id = '<id>'"`.

## Project Layout

```text
src/index.ts             routing: path then method, size, JSON, validation, store
src/schemas/v1.ts        payload type and validator for schemaVersion 1
src/targets/d1.ts        maps a payload to a row and inserts it
src/aggregate.ts         builds and (re)stores the public statistics, run hourly by the cron
src/page.ts              renders the public statistics page from a stored aggregate
migrations/              D1 schema, applied with `npm run migrate`
  0001_create_instance_pings.sql   the raw ping table
  0002_create_aggregates.sql       the one-row precomputed aggregate table
queries/                 one SQL report per file, run with `npm run stats`
scripts/stats.mjs        runs the reports through wrangler and prints them
scripts/seed-local.mjs   fills the local D1 with deterministic fixture pings
wrangler.toml            Worker name, route, the D1 binding and the cron trigger
```

This project is self-contained and does not import from the main app. `src/schemas/v1.ts` mirrors `TelemetryPayload` in [`lib/telemetry/schema.ts`](../lib/telemetry/schema.ts) by value, and `migrations/` mirrors it again as columns, so a change to the payload has to be made in all three places. Until a new `schemaVersion` exists, anything that is not a valid v1 payload is discarded.
