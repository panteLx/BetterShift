#!/usr/bin/env tsx
/**
 * Executable tenant-isolation regression check. `npm run test:tenancy`.
 *
 * Stage 1 (no server): pure host-parsing and slug-validation checks.
 * Stage 2 (needs a running server): seeds two workspaces directly via
 * Drizzle on the DB file the server was started against, then asserts
 * cross-workspace HTTP requests 404 and same-workspace ones succeed.
 *
 * Build and start the server first. `next start` does NOT work with this
 * project's `output: "standalone"` config (it warns and serves a broken
 * build) -- start the standalone entrypoint directly instead, after copying
 * the static assets next to it the way the Dockerfile does. DATABASE_URL
 * must be an ABSOLUTE path: server.js calls process.chdir(__dirname) into
 * .next/standalone/, so a relative path resolves differently for the server
 * than for this script, silently pointing them at two different DB files.
 * HOSTNAME must be set explicitly too -- server.js binds to
 * `process.env.HOSTNAME || "0.0.0.0"`, and an inherited shell HOSTNAME (e.g.
 * a machine hostname that resolves to a VPN/Tailscale address) silently
 * binds it off localhost.
 *
 *   npm run build
 *   cp -r .next/static .next/standalone/.next/static
 *   cp -r public .next/standalone/public
 *   PORT=3107 HOSTNAME=0.0.0.0 MULTI_TENANT=true TENANT_BASE_DOMAIN=tenancy.test \
 *     AUTH_ENABLED=true RATE_LIMIT_AUTH_REQUESTS=50 \
 *     DATABASE_URL="file:$(pwd)/data/tenancy-check.sqlite.db" \
 *     BETTER_AUTH_URL=http://tenancy.test BETTER_AUTH_SECRET=tenancy-check-secret \
 *     node .next/standalone/server.js &
 * (or `next dev` with the same env, skipping the standalone-only steps
 * above, for faster iteration). Then:
 *   DATABASE_URL="file:$(pwd)/data/tenancy-check.sqlite.db" TENANCY_CHECK_URL=http://localhost:3107 \
 *     npm run test:tenancy
 *
 * The harness needs the SAME DATABASE_URL as the running server (it seeds
 * directly into that file) and talks to the server over HTTP at
 * TENANCY_CHECK_URL (default http://localhost:3000), sending a `Host` header
 * of `<slug>.tenancy.test` per request — no real DNS or TLS needed since
 * Next reads the Host header, not the socket's actual destination.
 *
 * Refuses to run unless DATABASE_URL points somewhere other than the
 * default ./data/sqlite.db -- see assertSafeDatabaseUrl() below. That check
 * must run before anything that imports lib/db (directly, or transitively
 * via lib/workspace) is loaded, since lib/db opens its SQLite file as an
 * import-time side effect; the DB-backed modules are therefore loaded with
 * a dynamic import after the check instead of a static one.
 */
import http from "node:http";
import path from "node:path";
import { hashPassword } from "better-auth/crypto";
import { isValidSlugFormat, isReservedSlug } from "../lib/workspace-slugs";

function assertSafeDatabaseUrl(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error(
      "Refusing to run: DATABASE_URL is not set. This script destructively seeds two " +
        "workspaces and three users straight into whatever DB lib/db/index.ts opens, and " +
        "that module defaults to ./data/sqlite.db when DATABASE_URL is unset. Point it at a " +
        'throwaway file first, e.g. DATABASE_URL="file:$(pwd)/data/tenancy-check.sqlite.db"'
    );
    process.exit(1);
  }
  const resolved = path.resolve(raw.replace("file:", ""));
  const defaultPath = path.resolve(process.cwd(), "data", "sqlite.db");
  if (resolved === defaultPath) {
    console.error(
      `Refusing to run: DATABASE_URL resolves to the default DB path (${defaultPath}), which ` +
        'is likely a real database. Point it at a throwaway file instead, e.g. ' +
        'DATABASE_URL="file:$(pwd)/data/tenancy-check.sqlite.db"'
    );
    process.exit(1);
  }
}

assertSafeDatabaseUrl();

const BASE_DOMAIN = "tenancy.test";
const APP_URL = process.env.TENANCY_CHECK_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}`);
  }
}

// =====================================================
// DB-backed modules, loaded only after assertSafeDatabaseUrl() passes
// =====================================================
type DbModule = typeof import("../lib/db");
type SchemaModule = typeof import("../lib/db/schema");
type WorkspaceModule = typeof import("../lib/workspace");

let db: DbModule["db"];
let organization: SchemaModule["organization"];
let member: SchemaModule["member"];
let user: SchemaModule["user"];
let account: SchemaModule["account"];
let calendars: SchemaModule["calendars"];
let shifts: SchemaModule["shifts"];
let calendarNotes: SchemaModule["calendarNotes"];
let shiftPresets: SchemaModule["shiftPresets"];
let externalSyncs: SchemaModule["externalSyncs"];
let calendarPermissionBundles: SchemaModule["calendarPermissionBundles"];
let calendarShares: SchemaModule["calendarShares"];
let syncLogs: SchemaModule["syncLogs"];
let parseWorkspaceHost: WorkspaceModule["parseWorkspaceHost"];

async function loadDbBackedModules(): Promise<void> {
  const [dbModule, schemaModule, workspaceModule] = await Promise.all([
    import("../lib/db"),
    import("../lib/db/schema"),
    import("../lib/workspace"),
  ]);
  db = dbModule.db;
  ({
    organization,
    member,
    user,
    account,
    calendars,
    shifts,
    calendarNotes,
    shiftPresets,
    externalSyncs,
    calendarPermissionBundles,
    calendarShares,
    syncLogs,
  } = schemaModule);
  parseWorkspaceHost = workspaceModule.parseWorkspaceHost;
}

// =====================================================
// Stage 1: pure checks, no server, no seeded DB content
// =====================================================
function runPureChecks(): void {
  console.log("Stage 1: pure host/slug checks (no server)");
  check("apex host", parseWorkspaceHost(BASE_DOMAIN, BASE_DOMAIN).kind === "apex");
  check(
    "apex host with port",
    parseWorkspaceHost(`${BASE_DOMAIN}:3000`, BASE_DOMAIN).kind === "apex"
  );
  check("workspace subdomain", (() => {
    const r = parseWorkspaceHost(`alpha.${BASE_DOMAIN}`, BASE_DOMAIN);
    return r.kind === "workspace" && r.slug === "alpha";
  })());
  check(
    "nested subdomain is invalid",
    parseWorkspaceHost(`a.b.${BASE_DOMAIN}`, BASE_DOMAIN).kind === "invalid"
  );
  check(
    "foreign host is invalid",
    parseWorkspaceHost("evil.example.com", BASE_DOMAIN).kind === "invalid"
  );
  check("null host is invalid", parseWorkspaceHost(null, BASE_DOMAIN).kind === "invalid");
  check("empty base domain is invalid", parseWorkspaceHost(`alpha.${BASE_DOMAIN}`, "").kind === "invalid");
  check("valid slug format", isValidSlugFormat("alpha-team"));
  check("single-char slug rejected", !isValidSlugFormat("a"));
  check("leading hyphen rejected", !isValidSlugFormat("-alpha"));
  check("trailing hyphen rejected", !isValidSlugFormat("alpha-"));
  check("uppercase rejected", !isValidSlugFormat("Alpha"));
  check("reserved slug rejected", isReservedSlug("admin"));
  check("default is reserved", isReservedSlug("default"));
  check("bs-pr- prefix reserved", isReservedSlug("bs-pr-123"));
  check("ordinary slug not reserved", !isReservedSlug("alpha"));
}

// =====================================================
// Seeding (direct Drizzle writes, same DB file as the running server)
// =====================================================
export interface SeedUser {
  id: string;
  email: string;
  password: string;
}

export interface SeedData {
  workspaces: {
    alpha: { id: string; slug: string };
    beta: { id: string; slug: string };
  };
  users: {
    alphaOwner: SeedUser;
    betaOwner: SeedUser;
    sharedMember: SeedUser;
    noMembership: SeedUser;
  };
  calendars: {
    alpha: SeedCalendar;
    beta: SeedCalendar;
  };
}

/** A calendar plus one of each calendar-owned child resource, all in one workspace. */
export interface SeedCalendar {
  id: string;
  shiftId: string;
  noteId: string;
  presetId: string;
  syncId: string;
  syncLogId: string;
  /** Read-only share of this calendar with the sharedMember user. */
  shareId: string;
}

const PASSWORD = "tenancy-check-password-1!";

async function seedUser(email: string): Promise<SeedUser> {
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: email.split("@")[0],
    email,
    emailVerified: true,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(PASSWORD),
  });
  return { id, email, password: PASSWORD };
}

async function seedCalendar(
  workspaceId: string,
  ownerId: string,
  name: string,
  shareWithUserId: string
): Promise<SeedCalendar> {
  const id = crypto.randomUUID();
  await db.insert(calendars).values({ id, name, ownerId, workspaceId });
  const [shift] = await db
    .insert(shifts)
    .values({ calendarId: id, date: new Date(), startTime: "08:00", endTime: "16:00", title: `${name} shift`, createdBy: ownerId })
    .returning({ id: shifts.id });
  const [note] = await db
    .insert(calendarNotes)
    .values({ calendarId: id, date: new Date(), note: `${name} note`, createdBy: ownerId })
    .returning({ id: calendarNotes.id });
  const [preset] = await db
    .insert(shiftPresets)
    .values({ calendarId: id, title: `${name} preset`, startTime: "08:00", endTime: "16:00", createdBy: ownerId })
    .returning({ id: shiftPresets.id });
  // Unreachable URL: the manual-sync row must never get as far as fetching it.
  const [sync] = await db
    .insert(externalSyncs)
    .values({ calendarId: id, name: `${name} sync`, calendarUrl: "http://127.0.0.1:9/never.ics" })
    .returning({ id: externalSyncs.id });
  const [syncLog] = await db
    .insert(syncLogs)
    .values({ calendarId: id, externalSyncId: sync.id, externalSyncName: `${name} sync`, status: "success" })
    .returning({ id: syncLogs.id });
  // deleteSyncLogs included so the shared member (a member of both workspaces) can
  // exercise the cross-workspace DELETE /api/activity-logs isolation check.
  const [bundle] = await db
    .insert(calendarPermissionBundles)
    .values({ calendarId: id, name: "Read", seedKey: "read", capabilities: ["viewShifts", "viewNotesEvents", "viewStats", "deleteSyncLogs"] })
    .returning({ id: calendarPermissionBundles.id });
  const [share] = await db
    .insert(calendarShares)
    .values({ calendarId: id, userId: shareWithUserId, bundleId: bundle.id, sharedBy: ownerId })
    .returning({ id: calendarShares.id });
  return { id, shiftId: shift.id, noteId: note.id, presetId: preset.id, syncId: sync.id, syncLogId: syncLog.id, shareId: share.id };
}

async function seedWorkspace(slug: string): Promise<{ id: string; slug: string }> {
  const id = crypto.randomUUID();
  await db.insert(organization).values({ id, slug, name: slug });
  return { id, slug };
}

export async function seed(): Promise<SeedData> {
  const alpha = await seedWorkspace("alpha");
  const beta = await seedWorkspace("beta");
  const alphaOwner = await seedUser("alpha-owner@tenancy.test");
  const betaOwner = await seedUser("beta-owner@tenancy.test");
  const sharedMember = await seedUser("shared-member@tenancy.test");
  const noMembership = await seedUser("no-membership@tenancy.test");

  await db.insert(member).values([
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: alphaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: betaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: sharedMember.id, role: "member" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: sharedMember.id, role: "member" },
  ]);

  const alphaCalendar = await seedCalendar(alpha.id, alphaOwner.id, "Alpha Calendar", sharedMember.id);
  const betaCalendar = await seedCalendar(beta.id, betaOwner.id, "Beta Calendar", sharedMember.id);

  return {
    workspaces: { alpha, beta },
    users: { alphaOwner, betaOwner, sharedMember, noMembership },
    calendars: { alpha: alphaCalendar, beta: betaCalendar },
  };
}

// =====================================================
// Stage 2: HTTP isolation matrix
// =====================================================
export type Actor = "anonymous" | { email: string; password: string };

export interface MatrixRow {
  name: string;
  as: Actor;
  host: string;
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number | number[];
  /** Checked against the response's Location header (redirects are never followed). */
  expectLocation?: (location: string | null) => boolean;
  /** Optional extra assertion on the parsed JSON body, in addition to the status. */
  expectBody?: (body: unknown) => boolean;
}

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

// node:http, not fetch: undici silently replaces a caller-set Host header. Redirects are never followed.
function httpRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(new URL(path, APP_URL), { method, headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const sessionCookies = new Map<string, string>();

async function signIn(email: string, password: string, host: string): Promise<string> {
  // Keyed by email alone: sessions are host-independent, and every extra sign-in eats into
  // better-auth's own sign-in limiter (3 per 10s per IP), which is retried below.
  const key = email;
  const cached = sessionCookies.get(key);
  if (cached) return cached;

  let res: HttpResponse;
  for (let attempt = 0; ; attempt++) {
    res = await httpRequest(
      "/api/auth/sign-in/email",
      "POST",
      { "content-type": "application/json", host, origin: `http://${host}` },
      JSON.stringify({ email, password })
    );
    if (res.status !== 429 || attempt >= 3) break;
    const retryAfter = Number(res.headers["x-retry-after"]) || 10;
    await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Sign-in failed for ${email}@${host}: ${res.status} ${res.text}`);
  }
  const cookie = (res.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
  sessionCookies.set(key, cookie);
  return cookie;
}

export async function runRow(row: MatrixRow): Promise<boolean> {
  const expected = Array.isArray(row.expectStatus) ? row.expectStatus : [row.expectStatus];
  // Any failure here (bad sign-in, network error, ...) is reported as this row's
  // failure rather than aborting the rest of the matrix.
  try {
    const headers: Record<string, string> = { host: row.host, origin: `http://${row.host}` };
    if (row.as !== "anonymous") {
      headers.cookie = await signIn(row.as.email, row.as.password, row.host);
    }
    if (row.body !== undefined) headers["content-type"] = "application/json";

    const res = await httpRequest(
      row.path,
      row.method,
      headers,
      row.body !== undefined ? JSON.stringify(row.body) : undefined
    );
    const location = res.headers.location ?? null;
    let ok =
      expected.includes(res.status) &&
      (!row.expectLocation || row.expectLocation(location));
    if (ok && row.expectBody) {
      const body = ((): unknown => {
        try {
          return JSON.parse(res.text);
        } catch {
          return null;
        }
      })();
      ok = row.expectBody(body);
    }
    const locationNote = row.expectLocation ? `, location ${location}` : "";
    check(`${row.name} (got ${res.status}${locationNote}, want ${expected.join("|")})`, ok);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(`${row.name} (want ${expected.join("|")}, threw: ${message})`, false);
    return false;
  }
}

// Later tasks append rows to the returned array (and extend seed()/SeedData for
// the fixtures those rows need) rather than replacing the matrix wholesale.
export function buildMatrix(seeded: SeedData): MatrixRow[] {
  const alphaHost = `alpha.${BASE_DOMAIN}`;
  const betaHost = `beta.${BASE_DOMAIN}`;
  const alphaOwner = seeded.users.alphaOwner;
  const betaOwner = seeded.users.betaOwner;
  const sharedMember = seeded.users.sharedMember;
  const alphaCal = seeded.calendars.alpha;
  const betaCal = seeded.calendars.beta;

  // Every calendar-owned id lookup: foreign-workspace ids must 404 exactly like nonexistent ones.
  const foreign = (method: string, path: string, body?: unknown): MatrixRow => ({
    name: `alpha owner gets 404 for beta's ${method} ${path.replace(/[0-9a-f-]{36}/g, ":id")} via alpha's host`,
    as: alphaOwner,
    host: alphaHost,
    method,
    path,
    body,
    expectStatus: 404,
  });
  const own = (path: string): MatrixRow => ({
    name: `alpha owner can GET own ${path.replace(/[0-9a-f-]{36}/g, ":id")} via alpha's host`,
    as: alphaOwner,
    host: alphaHost,
    method: "GET",
    path,
    expectStatus: 200,
  });

  return [
    {
      name: "unknown subdomain returns 404",
      as: "anonymous",
      host: `doesnotexist.${BASE_DOMAIN}`,
      method: "GET",
      path: "/",
      expectStatus: 404,
    },
    {
      name: "GET /api/workspace on an unknown subdomain is 404",
      as: "anonymous",
      host: `doesnotexist.${BASE_DOMAIN}`,
      method: "GET",
      path: "/api/workspace",
      expectStatus: 404,
    },
    {
      name: "GET /api/workspace on a known workspace returns that workspace",
      as: "anonymous",
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/api/workspace",
      expectStatus: 200,
    },
    {
      name: "apex / without a session redirects toward login",
      as: "anonymous",
      host: BASE_DOMAIN,
      method: "GET",
      path: "/",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        !!location && new URL(location, `http://${BASE_DOMAIN}`).pathname === "/login",
    },
    {
      name: "apex / for a signed-in user without any workspace renders the no-workspace page",
      as: { email: "no-membership@tenancy.test", password: PASSWORD },
      host: BASE_DOMAIN,
      method: "GET",
      path: "/",
      expectStatus: 200,
    },
    {
      name: "container health probe on localhost bypasses workspace resolution",
      as: "anonymous",
      host: "localhost",
      method: "GET",
      path: "/api/health",
      expectStatus: 200,
    },
    {
      name: "workspace /login forwards to apex login with the absolute workspace target",
      as: "anonymous",
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/login?returnUrl=/foo",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        location ===
        `http://${BASE_DOMAIN}/login?returnUrl=${encodeURIComponent(`http://alpha.${BASE_DOMAIN}/foo`)}`,
    },
    {
      name: "workspace /login drops an off-site returnUrl",
      as: "anonymous",
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/login?returnUrl=//evil.example",
      expectStatus: [307, 308],
      expectLocation: (location) => {
        if (!location) return false;
        const target = new URL(location).searchParams.get("returnUrl") ?? "";
        return target.endsWith(`alpha.${BASE_DOMAIN}/`);
      },
    },
    own(`/api/calendars/${alphaCal.id}`),
    foreign("GET", `/api/calendars/${betaCal.id}`),
    foreign("PATCH", `/api/calendars/${betaCal.id}`, { name: "pwned" }),
    foreign("DELETE", `/api/calendars/${betaCal.id}`),
    own(`/api/shifts?calendarId=${alphaCal.id}`),
    foreign("GET", `/api/shifts?calendarId=${betaCal.id}`),
    foreign("POST", "/api/shifts", { calendarId: betaCal.id, date: "2026-09-28", startTime: "08:00", endTime: "16:00", title: "x" }),
    foreign("GET", `/api/shifts/stats?calendarId=${betaCal.id}`),
    own(`/api/shifts/${alphaCal.shiftId}`),
    foreign("GET", `/api/shifts/${betaCal.shiftId}`),
    foreign("PUT", `/api/shifts/${betaCal.shiftId}`, { title: "pwned" }),
    foreign("DELETE", `/api/shifts/${betaCal.shiftId}`),
    foreign("GET", `/api/shifts/${betaCal.shiftId}/signups`),
    foreign("POST", `/api/shifts/${betaCal.shiftId}/signups`, {}),
    foreign("DELETE", `/api/shifts/${betaCal.shiftId}/signups/${alphaOwner.id}`),
    own(`/api/notes?calendarId=${alphaCal.id}`),
    foreign("GET", `/api/notes?calendarId=${betaCal.id}`),
    foreign("POST", "/api/notes", { calendarId: betaCal.id, date: "2026-09-28", note: "x" }),
    own(`/api/notes/${alphaCal.noteId}`),
    foreign("GET", `/api/notes/${betaCal.noteId}`),
    foreign("PUT", `/api/notes/${betaCal.noteId}`, { note: "pwned" }),
    foreign("DELETE", `/api/notes/${betaCal.noteId}`),
    own(`/api/presets?calendarId=${alphaCal.id}`),
    foreign("GET", `/api/presets?calendarId=${betaCal.id}`),
    foreign("POST", "/api/presets", { calendarId: betaCal.id, title: "x", startTime: "08:00", endTime: "16:00" }),
    foreign("PATCH", "/api/presets/reorder", { calendarId: betaCal.id, presetOrders: [] }),
    own(`/api/presets/${alphaCal.presetId}`),
    foreign("GET", `/api/presets/${betaCal.presetId}`),
    foreign("PATCH", `/api/presets/${betaCal.presetId}`, { title: "pwned" }),
    foreign("DELETE", `/api/presets/${betaCal.presetId}`),
    own(`/api/external-syncs?calendarId=${alphaCal.id}`),
    foreign("GET", `/api/external-syncs?calendarId=${betaCal.id}`),
    foreign("POST", "/api/external-syncs", { calendarId: betaCal.id, name: "x", calendarUrl: "http://127.0.0.1:9/x.ics" }),
    own(`/api/external-syncs/${alphaCal.syncId}`),
    foreign("GET", `/api/external-syncs/${betaCal.syncId}`),
    foreign("PATCH", `/api/external-syncs/${betaCal.syncId}`, { name: "pwned" }),
    foreign("DELETE", `/api/external-syncs/${betaCal.syncId}`),
    foreign("POST", `/api/external-syncs/${betaCal.syncId}/sync`),
    own(`/api/sync-logs?calendarId=${alphaCal.id}`),
    foreign("GET", `/api/sync-logs?calendarId=${betaCal.id}`),
    foreign("PATCH", `/api/sync-logs?calendarId=${betaCal.id}&action=markErrorsAsRead`),
    foreign("DELETE", `/api/sync-logs?calendarId=${betaCal.id}`),
    foreign("POST", "/api/export/ics", { calendarIds: [betaCal.id] }),
    foreign("POST", "/api/export/pdf", { calendarIds: [betaCal.id] }),
    foreign("DELETE", `/api/calendars/${betaCal.id}/shares/${betaCal.shareId}`),
    foreign("POST", "/api/calendars/subscriptions", { calendarId: betaCal.id }),
    foreign("DELETE", `/api/calendars/subscriptions/${betaCal.id}`),
    {
      name: "GET /api/calendars on alpha only returns alpha's calendar",
      as: alphaOwner,
      host: alphaHost,
      method: "GET",
      path: "/api/calendars",
      expectStatus: 200,
      expectBody: (body) =>
        Array.isArray(body) &&
        body.every((c: { id: string }) => c.id === alphaCal.id),
    },
    {
      name: "GET /api/calendars on beta only returns beta's calendar",
      as: betaOwner,
      host: betaHost,
      method: "GET",
      path: "/api/calendars",
      expectStatus: 200,
      expectBody: (body) =>
        Array.isArray(body) &&
        body.every((c: { id: string }) => c.id === betaCal.id),
    },
    {
      name: "shared member gets 404 for a beta calendar shared with them via alpha's host",
      as: seeded.users.sharedMember,
      host: alphaHost,
      method: "GET",
      path: `/api/calendars/${betaCal.id}`,
      expectStatus: 404,
    },
    {
      name: "shared member can GET the beta calendar shared with them via beta's host",
      as: seeded.users.sharedMember,
      host: betaHost,
      method: "GET",
      path: `/api/calendars/${betaCal.id}`,
      expectStatus: 200,
    },
    {
      name: "beta owner gets 404 for their own calendar via alpha's host",
      as: betaOwner,
      host: alphaHost,
      method: "GET",
      path: `/api/calendars/${betaCal.id}`,
      expectStatus: 404,
    },
    {
      name: "beta owner can GET their own calendar via beta's host",
      as: betaOwner,
      host: betaHost,
      method: "GET",
      path: `/api/calendars/${betaCal.id}`,
      expectStatus: 200,
    },
    {
      name: "beta's shift survived every cross-workspace write attempt",
      as: betaOwner,
      host: betaHost,
      method: "GET",
      path: `/api/shifts/${betaCal.shiftId}`,
      expectStatus: 200,
    },
    // sharedMember holds an active share into both alpha's and beta's calendar (a real
    // multi-workspace membership, not a hypothetical one) -- before any dismissal, beta's
    // calendar must not surface in a subscriptions view fetched from alpha's host.
    {
      name: "shared member's alpha subscriptions view excludes beta's calendar before any dismissal",
      as: sharedMember,
      host: alphaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => {
        if (!body || typeof body !== "object") return false;
        const { available, dismissed } = body as {
          available?: Array<{ id: string }>;
          dismissed?: Array<{ id: string }>;
        };
        const ids = [...(available ?? []), ...(dismissed ?? [])].map((c) => c.id);
        return !ids.includes(betaCal.id);
      },
    },
    // A calendar dismissed via one workspace must not surface into another's view.
    {
      name: "shared member dismisses the beta calendar via beta's host",
      as: sharedMember,
      host: betaHost,
      method: "DELETE",
      path: `/api/calendars/subscriptions/${betaCal.id}`,
      expectStatus: 200,
    },
    {
      name: "dismissed beta calendar does not leak into alpha's subscriptions view",
      as: sharedMember,
      host: alphaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => {
        if (!body || typeof body !== "object") return false;
        const dismissed = (body as { dismissed?: Array<{ id: string }> }).dismissed;
        return Array.isArray(dismissed) && !dismissed.some((c) => c.id === betaCal.id);
      },
    },
    // sharedMember has deleteSyncLogs via a share into both alpha's and beta's calendar
    // (seedCalendar's bundle) -- clearing activity logs from alpha's host must only
    // touch alpha's sync logs, never beta's, even though the same user could clear
    // beta's from beta's host.
    {
      name: "shared member clears activity logs via alpha's host",
      as: sharedMember,
      host: alphaHost,
      method: "DELETE",
      path: "/api/activity-logs",
      expectStatus: 200,
    },
    {
      name: "alpha's sync log was deleted by the alpha-host activity-logs clear",
      as: alphaOwner,
      host: alphaHost,
      method: "GET",
      path: `/api/sync-logs?calendarId=${alphaCal.id}`,
      expectStatus: 200,
      expectBody: (body) => Array.isArray(body) && body.length === 0,
    },
    {
      name: "beta's sync log survived the alpha-host activity-logs clear",
      as: betaOwner,
      host: betaHost,
      method: "GET",
      path: `/api/sync-logs?calendarId=${betaCal.id}`,
      expectStatus: 200,
      expectBody: (body) =>
        Array.isArray(body) &&
        body.some((log: { id: string }) => log.id === betaCal.syncLogId),
    },
  ];
}

async function main(): Promise<void> {
  await loadDbBackedModules();

  runPureChecks();

  console.log("\nSeeding two workspaces via Drizzle...");
  const seeded = await seed();

  console.log("\nStage 2: HTTP isolation matrix");
  for (const row of buildMatrix(seeded)) {
    await runRow(row);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
