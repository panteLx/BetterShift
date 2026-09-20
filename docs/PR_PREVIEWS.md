# PR Preview Deployments Guide

This guide explains the automated preview environments BetterShift spins up for pull requests, what has to be configured on the server before the first one can deploy, and how to clean one up by hand if the automation doesn't.

## Table of Contents

1. [What It Does](#what-it-does)
2. [Prerequisites on the Server](#prerequisites-on-the-server)
3. [Secrets](#secrets)
4. [Variables](#variables)
5. [Cloudflare in Front](#cloudflare-in-front)
6. [How the Pieces Fit Together](#how-the-pieces-fit-together)
7. [What's Different in a Preview](#whats-different-in-a-preview)
8. [Manual Cleanup](#manual-cleanup)
9. [Security Note](#security-note)

---

## What It Does

Adding the `preview` label to a pull request from this repository gets it a running, seeded BetterShift instance at `https://pr-<number>.<PREVIEW_DOMAIN>`. Usually that takes a few minutes; in the worst case it takes considerably longer, because the deploy job first waits for the PR's image to finish building — that wait alone is allowed to run for up to 25 minutes. Every further push to the PR (a `synchronize` event) redeploys it from scratch: the old container and its data are destroyed first, so the instance always reflects the latest commit and starts from a clean, freshly seeded database.

Closing a PR that carries the `preview` label, or removing the label again, tears the instance down completely — container and data, nothing left behind. Closing a PR that never had the label does nothing: the `teardown` job checks for the label on the `closed` event and skips itself otherwise, so it doesn't go looking for a stack that was never created. Reopening a closed PR that still carries the `preview` label deploys it again, the same way a `synchronize` push does: fresh container, freshly reseeded database.

A pull request from a fork never gets a preview: `.github/workflows/pr-preview.yml` checks `head.repo.full_name` against the target repository and, for a fork PR that gets labeled `preview`, only writes an explanatory `::notice::` into the job log instead of deploying anything. It is a log line rather than a PR comment on purpose: a `pull_request` event from a fork gets a read-only `GITHUB_TOKEN` no matter what the workflow's `permissions:` block says, so posting a comment would simply fail with a 403. Whoever added the label has write access and can read the job. Fork PRs don't get repository secrets or a pushed image, so there would be nothing to deploy against anyway.

## Prerequisites on the Server

Before the first preview can go live, the server that Komodo deploys to needs:

- A wildcard DNS record on `*.<PREVIEW_DOMAIN>` pointing at that server.
- A running `caddy-docker-proxy` instance. It reads Docker labels on containers and reconfigures itself automatically — there's no reload step this feature has to trigger.
- The Docker network named in `PREVIEW_CADDY_NETWORK`, the one Caddy is attached to. If you don't know its name, find it with:

  ```bash
  docker inspect <caddy-container> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
  ```

- A Komodo instance reachable over HTTPS, with an API key/secret pair (`KOMODO_API_KEY` / `KOMODO_API_SECRET`) that can create, update, deploy, and delete stacks on the target server. Scope that key to the preview server only. Do **not** use an admin key: the same credentials would be able to reach and destroy your production stacks, and they live in a repository that anyone can open a pull request against.
- The GHCR package `ghcr.io/pantelx/bettershift` has to be **public**. The compose file `scripts/preview-stack.mjs` generates carries no registry credentials, so the Komodo host pulls the `pr-<n>` tag anonymously. If you keep the package private, the pull fails with "unauthorized" and you have to attach a Komodo `registry_account` to the stack config instead (and add the corresponding field in `stackConfig()`).

### Image Cleanup Is Your Job

Nothing in this feature prunes images. `docker compose down` — what a teardown runs — removes containers, not images, and every PR pulls a fresh `pr-<n>` image that then sits on the host forever. The first symptom of a full disk is usually an unrelated deploy failing, so treat this as a standing operator duty: run `docker image prune -af --filter "until=168h"` periodically on the preview host (a cron job, or a scheduled prune in Komodo).

The `pr-<n>` tags on ghcr.io are never deleted either, neither by the preview workflow nor by `docker-dev.yml`. That is a deliberate choice — tags cost little and keeping them makes a preview reproducible after the fact — not an oversight.

### One-Time Setup Checks

Four things depend on versions nobody here could verify in advance. Check them once, when setting this up on your server:

**1. Caddy version, for the Basic Auth label.** The compose file `scripts/preview-stack.mjs` generates uses the label `caddy.basic_auth.preview`. Caddy renamed the directive from `basicauth` to `basic_auth` in Caddy 2.8. Check your running version:

```bash
docker exec <caddy-container> caddy version
```

If it's older than 2.8, change the label key in `composeFile()` in `scripts/preview-stack.mjs` from `caddy.basic_auth.preview` to `caddy.basicauth.preview`.

**2. Komodo's `environment` field type.** `scripts/preview-stack.mjs` sends the stack's `environment` as a single newline-separated string (`KEY=value\nKEY=value`). Some Komodo versions instead expect a list of strings. Verify against your instance with a read against any existing stack:

```bash
curl -s -X POST "$KOMODO_URL/read/GetStack" \
  -H "x-api-key: $KOMODO_API_KEY" -H "x-api-secret: $KOMODO_API_SECRET" \
  -H "content-type: application/json" \
  -d '{"stack": "<existing-stack-name>"}' | jq '.config.environment'
```

If that comes back as an array rather than a string, the `environment` value built in `stackConfig()` in `scripts/preview-stack.mjs` needs to become an array of `"KEY=value"` strings instead of the joined string it is today.

**3. Komodo's request shape.** `komodo()` in `scripts/preview-stack.mjs` posts to one endpoint per call with the params as the body — `POST /read/GetStack` with `{"stack": …}`, `POST /execute/DeployStack` with `{"stack": …}`, and so on. Some Komodo versions instead expose a single endpoint per category and expect the call to be named in the body: `POST /read` with `{"type": "GetStack", "params": {"stack": …}}`. The curl above is the test: a `404` or `405` on `/read/GetStack` means your instance wants the other shape, and `komodo()` has to be changed to take a type plus params and post to `/read`, `/write` or `/execute`.

**4. What `/execute/*` returns.** `updateFailure()` in `scripts/preview-stack.mjs` reads the returned Update's `success` field to catch a compose run that failed behind an HTTP 200, but only once `status` says the update is complete — `success` is also `false` while it is still `Queued` or `InProgress`. If your instance returns the initial update under a different `status` spelling, watch the first real deploy: a successful deploy that nevertheless reports `DeployStack fehlgeschlagen.` means the terminal-state check in `updateFailure()` needs your instance's spelling.

## Secrets

Repository secrets the `deploy` job in `.github/workflows/pr-preview.yml` requires. Configure them under **Settings → Secrets and variables → Actions → Secrets** (repository secrets, not environment secrets):

| Secret | Contents |
| --- | --- |
| `KOMODO_API_KEY` | API key of a Komodo (service) user |
| `KOMODO_API_SECRET` | matching API secret |
| `PREVIEW_BETTER_AUTH_SECRET` | `BETTER_AUTH_SECRET` used by every preview instance |
| `PREVIEW_BASIC_AUTH_HASH` | bcrypt hash of the Basic Auth password |
| `PREVIEW_BASIC_AUTH_PASSWORD` | the same password, in plain text |
| `PREVIEW_ADMIN_PASSWORD` | password for the seed admin account |
| `PREVIEW_CF_BYPASS_TOKEN` | optional — shared value for the `X-Preview-CI-Bypass` header, see [Cloudflare in Front](#cloudflare-in-front) |

The Komodo user behind `KOMODO_API_KEY` needs permissions on two resource types, not one. On **Stacks**, level `Write` — that covers creating, updating and deleting them as well as the `Execute` that deploy and destroy need. On the **Server** named by `KOMODO_SERVER_ID`, level `Read` plus the specific permission `Attach`: Komodo checks separately whether a user may hang a new stack onto a given server, and without it `/write/CreateStack` fails with `Cannot attach Stack to this Server` even though every stack permission is in place. In TOML form that second part reads `all.Server = { level = "Read", specific = ["Attach"] }`.

Generate the hash with:

```bash
docker run --rm caddy caddy hash-password --plaintext '<password>'
```

Store its output in `PREVIEW_BASIC_AUTH_HASH` exactly as printed — plain, unescaped bcrypt hash, `$` characters and all. Do **not** pre-escape any `$` in it by hand: `scripts/preview-stack.mjs` already replaces every `$` with `$$` itself when it writes the value into the `.env` file Komodo hands to Docker Compose, because Compose expands `$`-variables inside `.env` values. Hand-escaping the hash before storing it would double the escaping and produce a broken hash on the other end.

`PREVIEW_BASIC_AUTH_PASSWORD` has to hold the plain-text password, not just the hash, because both the workflow's health check (a plain `curl` request) and `scripts/seed-preview.mjs` need to authenticate through Basic Auth themselves before they can reach the app at all.

Both seeded accounts get their address from `PREVIEW_DOMAIN`: `admin@<PREVIEW_DOMAIN>` and `member@<PREVIEW_DOMAIN>`. They are identifiers, nothing more — BetterShift sends no mail at all, so neither address has to be a real mailbox. There is no repository variable for either one; the workflow builds them, and `scripts/seed-preview.mjs` takes `PREVIEW_ADMIN_EMAIL` and `PREVIEW_MEMBER_EMAIL` for a run by hand against some other instance.

`PREVIEW_ADMIN_PASSWORD` has two constraints. It must be **at least 8 characters** long — better-auth enforces that minimum on `/api/auth/sign-up/email`, and a shorter one makes `scripts/seed-preview.mjs` fail with an opaque `400` that says nothing about the length. And it must be a **throwaway used nowhere else**: the deploy job writes it into the sticky PR comment in plain text, on a public repository, so anyone can read it. The member account the seed script creates (`mitarbeiter@preview.local`) is registered with the same password.

The Basic Auth username is fixed to `preview` — it's hardcoded into the compose label key (`caddy.basic_auth.preview`) and into the workflow's health-check `curl` call, and it's the default `scripts/seed-preview.mjs` falls back to (`PREVIEW_BASIC_AUTH_USER`, which this workflow never sets). There is no repository variable for it.

## Variables

Repository variables the `deploy` job reads. Same place, one tab over: **Settings → Secrets and variables → Actions → Variables**. `KOMODO_URL` doubles as the feature's on/off switch — while it is unset, the `teardown` job skips itself, so closing a PR on a repository that has no preview server configured doesn't produce a red job. The same job also skips a `closed` event on a PR that doesn't carry the `preview` label.

| Variable | Example |
| --- | --- |
| `KOMODO_URL` | `https://komodo.example.com` |
| `KOMODO_SERVER_ID` | ID of the server the previews are deployed to |
| `PREVIEW_DOMAIN` | `preview.example.com` |
| `PREVIEW_CADDY_NETWORK` | name of the Docker network Caddy is attached to (see [Prerequisites](#prerequisites-on-the-server)) |

## Cloudflare in Front

If the Komodo instance or the preview domain sits behind Cloudflare, the runner's requests look like bot traffic: they arrive from Azure datacenter ranges, and Cloudflare answers them with a challenge page (`Just a moment…`) under status `403`, which no script can solve. The symptom is a deploy or teardown failing with `/read/GetStack -> 403` followed by a page of markup. The same request from a residential connection goes straight through, so this only ever shows up in CI.

On this repository's own preview host the cause was Bot Fight Mode, and the fix was the zone toggle below — the header rule never came into play there. Don't assume that for another setup, though.

**First find out which feature fired.** In the Cloudflare dashboard, open **Security → Events** for that hostname and look at the *Service* column of the blocked request. The fix differs:

| Service | Fix |
| --- | --- |
| `Security Level`, `Browser Integrity Check`, `Custom rules`, `Managed rules` | the skip rule below |
| `Bot Fight Mode` | turn it off for this zone under **Security → Bots** — a skip rule has no effect on it |

Bot Fight Mode cannot be exempted: it doesn't run on the Ruleset Engine, so *Skip*, *Bypass* and *Allow* never reach it, and allowlisting the runners by IP is not an option either — GitHub Actions runs on thousands of rotating Azure ranges. Switching it off for a zone that only serves throwaway previews is the trade-off here; Komodo still requires its API key and secret, and every preview instance still sits behind Basic Auth.

For everything else, a WAF custom rule lets CI through, keyed on a header only CI knows. Zone-level custom rules are included in the Free plan (5 per zone) — this is not the account-level WAF, which is an Enterprise feature and is not needed:

1. Generate a random value (`openssl rand -hex 32`) and store it as the repository secret `PREVIEW_CF_BYPASS_TOKEN`. The workflow passes it as `X-Preview-CI-Bypass` on every request it makes — to Komodo, to the health check and from the seed script.
2. In Cloudflare, per zone, under **Security → WAF → Custom rules**, add a rule for the Komodo hostname and one for `*.<PREVIEW_DOMAIN>` matching `http.request.headers["x-preview-ci-bypass"][0] eq "<the same value>"`, with the action **Skip** and all remaining security products ticked.
3. Put that rule above any challenge rule — Cloudflare evaluates custom rules in order.

Leaving `PREVIEW_CF_BYPASS_TOKEN` unset is fine for a host that isn't behind Cloudflare, or where the fix was a toggle rather than a rule: the scripts then send no extra header. Either way, a challenge that comes back anyway is now named as such by both scripts and the health check, instead of being reported as a bare `403` with a page of HTML attached.

The header is a shared secret, not authentication — anyone who learns it can skip the WAF for those hostnames. Komodo's own API key and the Basic Auth in front of every preview instance still apply behind it.

Two details of the generated compose file are worth knowing before the first deploy. The site label is written as `caddy: http://pr-<n>.<PREVIEW_DOMAIN>` — the explicit scheme keeps Caddy from starting automatic HTTPS for a name that resolves to Cloudflare rather than to the server, which behind a TLS-terminating proxy ends in a redirect loop or a certificate order that can never complete.

## How the Pieces Fit Together

```text
PR gets the label "preview"
        │
        ▼
.github/workflows/pr-preview.yml (job: deploy)
        │
        ├─ wait (up to 25 min) for the "build-dev" check run (from the
        │   "Docker Dev Build" workflow) on the PR's head SHA
        │       ├─ success            → carry on
        │       ├─ failure/cancelled  → job fails
        │       └─ still no run after 3 min (docker-dev.yml has paths-ignore
        │           for messages/**, docs/** and **/*.md, so this commit
        │           never triggered a build)
        │               ├─ tag pr-<n> exists from an earlier push → carry on,
        │               │   and mark the deploy as running an older image
        │               └─ no tag at all → job fails
        ├─ node scripts/preview-stack.mjs deploy
        │       ├─ Komodo /read/GetStack, then /write/CreateStack or /write/UpdateStack
        │       └─ Komodo /execute/DeployStack (destroy_before_deploy: true)
        │               └─ server: docker compose up
        │                       └─ container carrying the Caddy labels
        │                               └─ caddy-docker-proxy picks up the
        │                                   subdomain live, no reload needed
        ├─ wait up to 5 min for GET /api/health == 200 (through Basic Auth)
        ├─ node scripts/seed-preview.mjs
        └─ sticky PR comment ("### Preview bereit") created or updated,
            naming the head commit — or, on the fallback path above,
            saying that the image comes from an earlier commit

PR carrying the label is closed  /  the "preview" label is removed
  /  the workflow is started by hand (Run workflow, with a PR number)
        │
        ▼
.github/workflows/pr-preview.yml (job: teardown)
        ├─ node scripts/preview-stack.mjs destroy
        │       ├─ Komodo /execute/DestroyStack
        │       └─ Komodo /write/DeleteStack
        └─ sticky PR comment rewritten to "### Preview abgeräumt"
```

`scripts/preview-stack.mjs` only ever talks to Komodo; it knows nothing about GitHub. `scripts/seed-preview.mjs` only ever talks to the running instance over plain HTTP; it knows nothing about Komodo or GitHub either — that's why it can also be pointed at any instance by hand, for testing, just by setting its environment variables.

## What's Different in a Preview

A few things distinguish a preview container from a normal deployment:

- **No volumes.** The compose file `preview-stack.mjs` generates has no `volumes:` section at all — SQLite and any uploads live in the container's own writable layer. Combined with `destroy_before_deploy: true`, that means every push resets the instance completely and the seed script runs again from an empty database. This is deliberate, not a gap: state is meant to be disposable here.
- **`ALLOW_USER_REGISTRATION=true`** is set on the container so that `scripts/seed-preview.mjs` can register its accounts through the regular `/api/auth/sign-up/email` route, the same way a real user would.
- **The first account the seed script registers becomes superadmin automatically** — that's standard BetterShift behaviour for the first user on any fresh instance (`lib/auth/first-user.ts`), not something specific to previews.
- `AUTH_ENABLED=true`, `TZ=Europe/Berlin` and `DEFAULT_LOCALE=de` are also fixed on the container (overridable only by setting `PREVIEW_TZ` / `PREVIEW_LOCALE` in the workflow's own environment before it calls `scripts/preview-stack.mjs`, since the script falls back to those defaults itself).
- **`TRUSTED_PROXY_HEADER=CF-Connecting-IP`** is set because previews are served through Cloudflare in front of Caddy. With two proxies in the chain, the last `X-Forwarded-For` entry is Cloudflare's address rather than the visitor's, which would make the rate limiter treat every visitor as the same client. If your preview host is not behind Cloudflare, drop this line from `composeFile()` — naming a header the proxy does not set is worse than naming none.
- **`CSP_STRICT_DYNAMIC_BYPASS=true`** relaxes `script-src` to `'self' 'unsafe-inline'`. Cloudflare's Rocket Loader rewrites the page and reconstructs inline scripts without their nonce, which the strict policy then blocks — the app fails to load with no obvious cause. Once Rocket Loader is confirmed off for the preview domain, remove this line so previews exercise the same CSP as production.

## Manual Cleanup

If a teardown run failed, or a stack was left standing on purpose after a broken deploy (see "Note that a health check that times out…" at the end of this section), the easiest fix is the workflow's manual entry point: **Actions → PR Preview → Run workflow**, enter the PR number, start it. That runs the `teardown` job for exactly that PR — destroy the stack, delete it in Komodo, rewrite the sticky comment — without needing any further event on the PR. A closed PR emits no event you could retry, so this is the only in-GitHub way back.

Alternatively, from a checkout with the Komodo credentials at hand:

```bash
KOMODO_URL=… KOMODO_API_KEY=… KOMODO_API_SECRET=… PR_NUMBER=<n> \
  node scripts/preview-stack.mjs destroy
```

This is safe to run even if the stack is already gone — `scripts/preview-stack.mjs` checks for it first and does nothing if it can't find it. If Komodo is behind Cloudflare, add `PREVIEW_CF_BYPASS_TOKEN=…` to that line as well (see [Cloudflare in Front](#cloudflare-in-front)).

Note that a health check that times out during deploy deliberately leaves the stack running instead of tearing it down: the whole point is to keep the container's logs inspectable in Komodo while you figure out what went wrong. The same is true if the seed step fails. In both cases nothing removes the stack automatically — use the command above once you're done investigating.

## Security Note

This repository is public, and a PR comment is world-readable. The sticky comment the `deploy` job posts therefore includes the login of both seeded accounts — the admin and the member — so anyone can look at the preview from either side, but never the Basic Auth password — that one stays a repository secret and is never written into a comment.

Preview instances only ever contain data `scripts/seed-preview.mjs` generates itself: fictional names, fictional calendars, fictional shifts. Nothing from a real deployment is ever copied into a preview.
