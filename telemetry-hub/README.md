# BetterShift Telemetry Hub

A small Cloudflare Worker that receives the opt-in, anonymous instance pings of BetterShift and forwards them to [PostHog](https://posthog.com/). It stores nothing itself.

You only need this if you want to **run your own receiver**. By default, instances send to the maintainer's hub, and an admin can opt out completely. What is sent is documented field by field in [`docs/TELEMETRY.md`](../docs/TELEMETRY.md).

The hub is deployed on its own and is not part of the Docker image.

## Table of Contents

1. [What You Need](#what-you-need)
2. [Set It Up](#set-it-up)
3. [Point Your Instances at It](#point-your-instances-at-it)
4. [Test It Locally](#test-it-locally)
5. [What the Worker Does](#what-the-worker-does)
6. [The PostHog Dashboards](#the-posthog-dashboards)
7. [Operating It](#operating-it)
8. [Project Layout](#project-layout)

---

## What You Need

- A **Cloudflare account** (the free plan is enough).
- A **PostHog project**, cloud EU or US. Use the _project API key_ (`phc_...`), not a personal key.
- **Node.js 20.12 or newer** on the machine you deploy from.
- Optional: a domain on Cloudflare, if you want a URL like `telemetry.example.com`. Without one, the Worker is served from a free `*.workers.dev` address.

## Set It Up

All commands run in this directory (`telemetry-hub/`).

### 1. Install

```bash
npm install
npx wrangler login
```

### 2. Adjust `wrangler.toml`

The committed file describes the maintainer's deployment. Change it before your first deploy:

| Setting        | What to do                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | Any unique Worker name.                                                                                                                                          |
| `routes`       | Replace `pattern` and `zone_name` with your own hostname and the Cloudflare zone it belongs to. Cloudflare creates the DNS record and certificate for you.      |
| `POSTHOG_HOST` | The **ingest** host of your PostHog region: `https://eu.i.posthog.com` or `https://us.i.posthog.com`. It must match the region of the project key (see below). |

No domain? Delete the whole `routes` block and add `workers_dev = true` instead. After the deploy, Wrangler prints the `https://<name>.<your-subdomain>.workers.dev` URL.

### 3. Store the PostHog key as a secret

```bash
npx wrangler secret put POSTHOG_API_KEY
```

Paste the project API key (PostHog → Project settings → Project API key). It is stored encrypted in Cloudflare and is never written to `wrangler.toml` or the repository.

A key only works against its own region. An EU project used with `us.i.posthog.com` (or the other way round) is rejected, and because the Worker always answers `200`, you would see no error on the sender's side. See [Operating It](#operating-it) for where to look.

### 4. Deploy

```bash
npm run deploy
```

### 5. Check that it arrived

Send one valid ping with an id you can recognise later:

```bash
curl -i -X POST https://YOUR-HUB-URL \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":1,"instanceId":"smoke-test","sentAt":"2026-01-01T00:00:00.000Z","app":{"version":"0.0.0","isDev":true,"migrations":0},"runtime":{"node":"24.0.0","arch":"x64","platform":"linux","sqlite":"3.45.1","timezone":"UTC"},"config":{"authEnabled":true,"guestAccess":false,"registrationOpen":false,"defaultLocale":"en","updateCheckEnabled":true,"rateLimitOverrides":0},"scale":{"users":"1-5","calendars":"1-5","shifts":"1-5","presets":"0","notes":"0","bundles":"0","shares":"0","accessTokens":"0","signups":"0"},"features":{"externalSyncs":"0","calendarViewOverrides":"0","customFields":{"count":"0","types":[]},"archivedPresets":false,"splitShifts":false},"health":{"uptimeHours":1,"syncRuns24h":0,"syncFailures24h":0}}'
```

You should get `HTTP/2 200`, and an `instance_ping` event for `smoke-test` should show up in PostHog → Activity within a minute.

**A `200` alone proves nothing.** The Worker also answers `200` to payloads it discards and to failed forwards, on purpose (see [What the Worker Does](#what-the-worker-does)). The event in PostHog is the real confirmation.

## Point Your Instances at It

Set this in the `.env` of every BetterShift instance that should report to you:

```env
TELEMETRY_ENDPOINT=https://YOUR-HUB-URL
```

Use the bare URL without a path. Telemetry itself stays opt-in: the instance admin still has to agree in the app, or you set `TELEMETRY_ENABLED=true` to switch it on for a deployment you control. Details are in [`docs/TELEMETRY.md`](../docs/TELEMETRY.md#turning-it-off).

## Test It Locally

Create `.dev.vars` in this directory:

```env
POSTHOG_API_KEY=phc_your_key
POSTHOG_HOST=https://eu.i.posthog.com
```

Then start the dev server:

```bash
npm run dev
```

The Worker then listens on `http://localhost:8787`. Use the `curl` command from step 5 against that URL. `.dev.vars` is gitignored and only read by `wrangler dev`.

Use a throwaway PostHog project for this. Local test pings otherwise mix into your real data.

`npm run typecheck` checks the types.

## What the Worker Does

| Request                                              | Answer                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Any method except `POST`                             | `405`                                                                                           |
| Body larger than 16 KB                               | `413`                                                                                           |
| Body is not valid JSON                               | `400`                                                                                           |
| Valid JSON that fails validation, or unknown version | `200`, discarded                                                                                |
| Valid v1 payload                                     | `200`, forwarded to PostHog. If PostHog rejects it, still `200`; the error message is logged.   |

The senders are fire-and-forget and never retry, so a payload the Worker cannot forward is lost. That is by design: the Worker has no database, queue or request log.

Every event is sent to PostHog with `$ip: null` and `$geoip_disable: true`, so PostHog stores neither the sender's IP nor a location derived from it. Person profiles are switched off as well, since an instance is not a person. Each field is passed on explicitly; nothing is spread from the request body.

Cloudflare itself still sees the connecting IP in its own edge logs, like for any hosted Worker. The Worker code never reads or stores it.

## The PostHog Dashboards

`scripts/create-posthog-dashboard.mjs` builds ready-made dashboards (growth, versions, environment, sizes, configuration, features, health) from the `instance_ping` events. It uses a **personal** API key, not the project key of the Worker.

```bash
cp .env.example .env    # then fill in POSTHOG_PERSONAL_API_KEY
npm run dashboard -- --dry-run
npm run dashboard
```

The script also creates variants without dev builds, with dev builds only, and without your own test instances (`EXCLUDE_INSTANCE_IDS`, for example `smoke-test`). Run it again at any time: existing dashboards are matched by name and updated in place. All options are described in `.env.example` and in the header of the script.

If your PostHog project is in the US region, set `POSTHOG_HOST=https://us.posthog.com` in `.env` (the app host, not the `i.` ingest host).

## Operating It

- **Live logs:** `npx wrangler tail`. A failed forward appears as one line with the PostHog status, never the payload.
- **Nothing shows up in PostHog:** check, in this order, that the ping reached the Worker (`wrangler tail` while sending), that the key belongs to the region set in `POSTHOG_HOST`, and that the sender is a real v1 payload (an invalid one is discarded silently).
- **Rotating the key:** run `npx wrangler secret put POSTHOG_API_KEY` again. No redeploy is needed.
## Project Layout

```text
src/index.ts             request handling: method, size, JSON, validation, forward
src/schemas/v1.ts        payload type and validator for schemaVersion 1
src/targets/posthog.ts   maps a payload to a PostHog event
scripts/                 create-posthog-dashboard.mjs
wrangler.toml            Worker name, route and the PostHog host
```

This project is self-contained and does not import from the main app. `src/schemas/v1.ts` mirrors `TelemetryPayload` in [`lib/telemetry/schema.ts`](../lib/telemetry/schema.ts) by value, so a change to the payload has to be made in both places. Until a new `schemaVersion` exists, anything that is not a valid v1 payload is discarded.
