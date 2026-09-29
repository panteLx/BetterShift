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
 * binds it off localhost. Don't use HOSTNAME=127.0.0.1 either: Next reports a
 * loopback bind as "localhost" to the proxy and then fails its internal rewrites
 * (the workspace-not-found rows go 500), see docs/MULTI_TENANCY.md.
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
 * With the portal on a subdomain (BETTER_AUTH_URL=http://app.tenancy.test), pass
 * TENANCY_CHECK_PORTAL_HOST=app.tenancy.test as well; CI runs both layouts.
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
import { isValidSlugFormat, isReservedSlug, parseReservedSlugs, suggestSlug } from "../lib/workspace-slugs";
import { workspaceOrigin } from "../lib/workspace-url";

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

export const BASE_DOMAIN = "tenancy.test";
// Must be the host of the server's BETTER_AUTH_URL: the base domain itself or e.g. app.tenancy.test.
export const PORTAL_HOST = process.env.TENANCY_CHECK_PORTAL_HOST || BASE_DOMAIN;
const APP_URL = process.env.TENANCY_CHECK_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

export function check(name: string, condition: boolean): void {
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
let calendarAccessTokens: SchemaModule["calendarAccessTokens"];
let calendarFeedTokens: SchemaModule["calendarFeedTokens"];
let syncLogs: SchemaModule["syncLogs"];
let announcements: SchemaModule["announcements"];
let auditLogs: SchemaModule["auditLogs"];
let workspaceSettings: SchemaModule["workspaceSettings"];
let userCalendarSubscriptions: SchemaModule["userCalendarSubscriptions"];
let calendarCustomFields: SchemaModule["calendarCustomFields"];
let eq: typeof import("drizzle-orm")["eq"];
let parseWorkspaceHost: WorkspaceModule["parseWorkspaceHost"];
let getPortalHostError: WorkspaceModule["getPortalHostError"];

async function loadDbBackedModules(): Promise<void> {
  const [dbModule, schemaModule, workspaceModule, drizzleModule] = await Promise.all([
    import("../lib/db"),
    import("../lib/db/schema"),
    import("../lib/workspace"),
    import("drizzle-orm"),
  ]);
  db = dbModule.db;
  eq = drizzleModule.eq;
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
    calendarAccessTokens,
    calendarFeedTokens,
    syncLogs,
    announcements,
    auditLogs,
    workspaceSettings,
    userCalendarSubscriptions,
    calendarCustomFields,
  } = schemaModule);
  parseWorkspaceHost = workspaceModule.parseWorkspaceHost;
  getPortalHostError = workspaceModule.getPortalHostError;
}

// =====================================================
// Stage 1: pure checks, no server, no seeded DB content
// =====================================================
function runPureChecks(): void {
  console.log("Stage 1: pure host/slug checks (no server)");
  check("base domain is the portal by default", parseWorkspaceHost(BASE_DOMAIN, BASE_DOMAIN).kind === "portal");
  check(
    "portal host with port",
    parseWorkspaceHost(`${BASE_DOMAIN}:3000`, BASE_DOMAIN).kind === "portal"
  );
  check(
    "portal on a subdomain",
    parseWorkspaceHost(`app.${BASE_DOMAIN}`, BASE_DOMAIN, `app.${BASE_DOMAIN}`).kind === "portal"
  );
  check(
    "bare base domain is invalid when the portal is a subdomain",
    parseWorkspaceHost(BASE_DOMAIN, BASE_DOMAIN, `app.${BASE_DOMAIN}`).kind === "invalid"
  );
  check("workspace subdomain next to a subdomain portal", (() => {
    const r = parseWorkspaceHost(`alpha.${BASE_DOMAIN}`, BASE_DOMAIN, `app.${BASE_DOMAIN}`);
    return r.kind === "workspace" && r.slug === "alpha";
  })());
  check("portal on the base domain is valid config", getPortalHostError(`https://${BASE_DOMAIN}`, BASE_DOMAIN) === null);
  check("portal on a reserved subdomain is valid config", getPortalHostError(`https://app.${BASE_DOMAIN}:8443`, BASE_DOMAIN) === null);
  check("portal on a non-reserved subdomain is rejected", getPortalHostError(`https://alpha.${BASE_DOMAIN}`, BASE_DOMAIN) !== null);
  check("portal two levels down is rejected", getPortalHostError(`https://a.app.${BASE_DOMAIN}`, BASE_DOMAIN) !== null);
  check("portal outside the base domain is rejected", getPortalHostError("https://example.com", BASE_DOMAIN) !== null);
  check("unparsable BETTER_AUTH_URL is rejected", getPortalHostError("not a url", BASE_DOMAIN) !== null);
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
  check("slug of 3 chars is valid", isValidSlugFormat("abc"));
  check("slug of 2 chars is invalid", !isValidSlugFormat("ab"));
  check("slug of 32 chars is valid", isValidSlugFormat("a".repeat(32)));
  check("slug of 33 chars is invalid", !isValidSlugFormat("a".repeat(33)));
  check("slug with trailing hyphen is invalid", !isValidSlugFormat("abc-"));
  check("parseReservedSlugs trims, lowercases and drops empties",
    [...parseReservedSlugs(" Foo, bar ,,")].sort().join(",") === "bar,foo");
  check("parseReservedSlugs(undefined) is empty", parseReservedSlugs(undefined).size === 0);
  check("suggestSlug strips diacritics and punctuation", suggestSlug("Pflegeteam Süd!") === "pflegeteam-sud");
  check("suggestSlug caps at 32 chars without a trailing hyphen",
    suggestSlug("a".repeat(31) + " b") === "a".repeat(31));
  check("workspaceOrigin keeps scheme and port of the portal URL",
    workspaceOrigin("alpha", "http://app.tenancy.test:3107", "tenancy.test") === "http://alpha.tenancy.test:3107");
  check("workspaceOrigin without port",
    workspaceOrigin("alpha", "https://app.ssx.si", "ssx.si") === "https://alpha.ssx.si");
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
    /** Plain alpha member with no share: the positive control for search and sharing. */
    alphaMember: SeedUser;
    /** Instance admin with no workspace membership at all. */
    admin: SeedUser;
  };
  calendars: {
    alpha: SeedCalendar;
    beta: SeedCalendar;
  };
  tokens: {
    /** Active share link for alpha's calendar. */
    alphaShare: string;
    /** Deactivated share link for alpha's calendar. */
    alphaShareRevoked: string;
    /** alphaOwner's ICS feed token for alpha's calendar. */
    alphaFeed: string;
  };
  /** Titles of the seeded dashboard announcements, one per scope. */
  announcements: { alphaOnly: string; betaOnly: string; everywhere: string };
  /** Actions of user-visible audit rows seeded for alphaOwner, one per scope. */
  auditActions: { alpha: string; beta: string; instance: string };
  /** Calendars with a guest bundle; guest access is ON in alpha and OFF in beta. */
  publicCalendars: { alpha: string; beta: string };
  /** Beta-owned child ids for the foreign-vs-missing identity checks. */
  betaChildren: { tokenId: string; customFieldId: string };
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
  bundleId: string;
}

export const PASSWORD = "tenancy-check-password-1!";

export async function seedUser(email: string, role?: string): Promise<SeedUser> {
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: email.split("@")[0],
    email,
    emailVerified: true,
    role,
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

export async function seedCalendar(
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
  return { id, shiftId: shift.id, noteId: note.id, presetId: preset.id, syncId: sync.id, syncLogId: syncLog.id, shareId: share.id, bundleId: bundle.id };
}

// Owned by a dedicated member so the owners' own calendar lists stay single-calendar.
async function seedPublicCalendar(workspaceId: string, ownerEmail: string, name: string): Promise<string> {
  const owner = await seedUser(ownerEmail);
  await db.insert(member).values({ id: crypto.randomUUID(), organizationId: workspaceId, userId: owner.id, role: "member" });
  const id = crypto.randomUUID();
  await db.insert(calendars).values({ id, name, ownerId: owner.id, workspaceId });
  const [bundle] = await db
    .insert(calendarPermissionBundles)
    .values({ calendarId: id, name: "Read", seedKey: "read", capabilities: ["viewShifts", "viewNotesEvents", "viewStats"] })
    .returning({ id: calendarPermissionBundles.id });
  await db.update(calendars).set({ guestBundleId: bundle.id }).where(eq(calendars.id, id));
  return id;
}

async function seedShareToken(calendar: SeedCalendar, createdBy: string, isActive = true): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  await db
    .insert(calendarAccessTokens)
    .values({ calendarId: calendar.id, token, bundleId: calendar.bundleId, createdBy, isActive });
  return token;
}

export async function seedFeedToken(calendarId: string, userId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "");
  await db.insert(calendarFeedTokens).values({ calendarId, userId, token, createdAt: new Date() });
  return token;
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
  const alphaMember = await seedUser("alpha-member@tenancy.test");
  const admin = await seedUser("instance-admin@tenancy.test", "superadmin");

  await db.insert(member).values([
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: alphaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: betaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: sharedMember.id, role: "member" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: sharedMember.id, role: "member" },
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: alphaMember.id, role: "member" },
  ]);

  const alphaCalendar = await seedCalendar(alpha.id, alphaOwner.id, "Alpha Calendar", sharedMember.id);
  const betaCalendar = await seedCalendar(beta.id, betaOwner.id, "Beta Calendar", sharedMember.id);

  const announcementTitles = { alphaOnly: "Alpha only", betaOnly: "Beta only", everywhere: "Everywhere" };
  await db.insert(announcements).values([
    { title: announcementTitles.alphaOnly, showOnDashboard: true, workspaceId: alpha.id },
    { title: announcementTitles.betaOnly, showOnDashboard: true, workspaceId: beta.id },
    { title: announcementTitles.everywhere, showOnDashboard: true, workspaceId: null },
  ]);

  // The beta row is alphaOwner's own and user-visible, so only the workspace filter can hide it on alpha.
  const auditActions = {
    alpha: "calendar.tenancy_alpha",
    beta: "calendar.tenancy_beta",
    instance: "security.tenancy_instance",
  };
  await db.insert(auditLogs).values([
    { action: auditActions.alpha, userId: alphaOwner.id, isUserVisible: true, workspaceId: alpha.id },
    { action: auditActions.beta, userId: alphaOwner.id, isUserVisible: true, workspaceId: beta.id },
    { action: auditActions.instance, userId: alphaOwner.id, isUserVisible: true, workspaceId: null },
  ]);

  // Named distinctly from seedCalendar()'s own sync log, so GET /api/activity-logs?type=sync
  // (workspace-scoped via getUserAccessibleCalendars, not the audit-log workspaceId column) can be proven isolated.
  // externalSyncId reuses each calendar's already-seeded sync row: better-sqlite3 enforces
  // foreign keys by default here, so a fresh randomUUID() would violate the FK constraint.
  await db.insert(syncLogs).values([
    { calendarId: alphaCalendar.id, externalSyncId: alphaCalendar.syncId, externalSyncName: "Alpha Sync", status: "success", syncType: "manual", shiftsCreated: 0, shiftsUpdated: 0, shiftsDeleted: 0 },
    { calendarId: betaCalendar.id, externalSyncId: betaCalendar.syncId, externalSyncName: "Beta Sync", status: "success", syncType: "manual", shiftsCreated: 0, shiftsUpdated: 0, shiftsDeleted: 0 },
  ]);

  const publicCalendars = {
    alpha: await seedPublicCalendar(alpha.id, "alpha-publisher@tenancy.test", "Alpha Public"),
    beta: await seedPublicCalendar(beta.id, "beta-publisher@tenancy.test", "Beta Public"),
  };
  await db.insert(workspaceSettings).values([
    { workspaceId: alpha.id, allowGuestAccess: true },
    { workspaceId: beta.id, allowGuestAccess: false },
  ]);
  // A pre-existing subscription, so only the membership rule can keep it closed.
  await db.insert(userCalendarSubscriptions).values({
    userId: noMembership.id,
    calendarId: publicCalendars.beta,
    status: "subscribed",
    source: "guest",
  });

  const [betaToken] = await db
    .insert(calendarAccessTokens)
    .values({ calendarId: betaCalendar.id, token: crypto.randomUUID().replace(/-/g, ""), bundleId: betaCalendar.bundleId, createdBy: betaOwner.id })
    .returning({ id: calendarAccessTokens.id });
  const [betaField] = await db
    .insert(calendarCustomFields)
    .values({ calendarId: betaCalendar.id, key: "beta_field", label: "Beta field", type: "text" })
    .returning({ id: calendarCustomFields.id });

  return {
    publicCalendars,
    betaChildren: { tokenId: betaToken.id, customFieldId: betaField.id },
    workspaces: { alpha, beta },
    users: { alphaOwner, betaOwner, sharedMember, noMembership, alphaMember, admin },
    calendars: { alpha: alphaCalendar, beta: betaCalendar },
    tokens: {
      alphaShare: await seedShareToken(alphaCalendar, alphaOwner.id),
      alphaShareRevoked: await seedShareToken(alphaCalendar, alphaOwner.id, false),
      alphaFeed: await seedFeedToken(alphaCalendar.id, alphaOwner.id),
    },
    announcements: announcementTitles,
    auditActions,
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
  /** Optional assertion on the raw response text (HTML pages). */
  expectText?: (text: string) => boolean;
  headers?: Record<string, string>;
}

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
}

// node:http, not fetch: undici silently replaces a caller-set Host header. Redirects are never followed.
export function httpRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  // node:http neither chunks nor length-frames a DELETE body by default, so the server would never see it.
  if (body !== undefined) headers = { ...headers, "content-length": String(Buffer.byteLength(body)) };
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

export async function signIn(email: string, password: string, host: string): Promise<string> {
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
    const headers: Record<string, string> = { host: row.host, origin: `http://${row.host}`, ...row.headers };
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
    if (ok && row.expectText) ok = row.expectText(res.text);
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

  // Unknown, foreign-workspace and wrong-host feed tokens must be indistinguishable.
  const feedNotFound: MatrixRow = {
    name: "",
    as: "anonymous",
    host: alphaHost,
    method: "GET",
    path: "",
    expectStatus: 404,
    expectBody: (body) => JSON.stringify(body) === JSON.stringify({ error: "Not found" }),
  };

  const subdomainPortalRows: MatrixRow[] =
    PORTAL_HOST === BASE_DOMAIN
      ? []
      : [
          {
            name: "bare base domain returns 404 when the portal is a subdomain",
            as: "anonymous",
            host: BASE_DOMAIN,
            method: "GET",
            path: "/",
            expectStatus: 404,
          },
          {
            name: "bare base domain /login returns 404 when the portal is a subdomain",
            as: "anonymous",
            host: BASE_DOMAIN,
            method: "GET",
            path: "/login",
            expectStatus: 404,
          },
          {
            name: "bare base domain auth API returns 404 when the portal is a subdomain",
            as: "anonymous",
            host: BASE_DOMAIN,
            method: "GET",
            path: "/api/auth/get-session",
            expectStatus: 404,
          },
        ];

  return [
    ...subdomainPortalRows,
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
      name: "portal / without a session redirects toward login",
      as: "anonymous",
      host: PORTAL_HOST,
      method: "GET",
      path: "/",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        !!location && new URL(location, `http://${PORTAL_HOST}`).pathname === "/login",
    },
    {
      name: "portal / for a signed-in user without any workspace renders the overview with create and join",
      as: { email: "no-membership@tenancy.test", password: PASSWORD },
      host: PORTAL_HOST,
      method: "GET",
      path: "/",
      headers: { "accept-language": "en" },
      expectStatus: 200,
      expectText: (text) => text.includes("Your workspaces") && text.includes("Create workspace"),
    },
    {
      name: "portal / for a member renders the overview instead of redirecting",
      as: { email: "shared-member@tenancy.test", password: PASSWORD },
      host: PORTAL_HOST,
      method: "GET",
      path: "/",
      headers: { "accept-language": "en" },
      expectStatus: 200,
      expectText: (text) => text.includes("Your workspaces"),
    },
    {
      name: "portal /new without a session redirects to login with returnUrl",
      as: "anonymous",
      host: PORTAL_HOST,
      method: "GET",
      path: "/new",
      expectStatus: [307, 308],
      expectLocation: (location) => !!location && location.includes("/login?returnUrl=%2Fnew"),
    },
    {
      name: "portal /join/<token> without a session redirects to login with returnUrl",
      as: "anonymous",
      host: PORTAL_HOST,
      method: "GET",
      path: "/join/abc",
      expectStatus: [307, 308],
      expectLocation: (location) => !!location && location.includes("/login?returnUrl=%2Fjoin%2Fabc"),
    },
    {
      name: "/portal is 404 on a workspace host",
      as: "anonymous",
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/portal",
      expectStatus: 404,
    },
    {
      name: "/no-workspace no longer exists on the portal",
      as: "anonymous",
      host: PORTAL_HOST,
      method: "GET",
      path: "/no-workspace",
      expectStatus: 404,
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
      name: "workspace /login forwards to portal login with the absolute workspace target",
      as: "anonymous",
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/login?returnUrl=/foo",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        location ===
        `http://${PORTAL_HOST}/login?returnUrl=${encodeURIComponent(`http://alpha.${BASE_DOMAIN}/foo`)}`,
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
    // Must run before the activity-logs clear below, which deletes every sync log
    // visible on alpha's host (including this seeded one) as part of its own proof.
    {
      name: "alpha's activity log never shows beta's sync log",
      as: alphaOwner,
      host: alphaHost,
      method: "GET",
      path: "/api/activity-logs?type=sync",
      expectStatus: 200,
      expectBody: (body) =>
        !JSON.stringify(body).includes("Beta Sync") && JSON.stringify(body).includes("Alpha Sync"),
    },
    // sharedMember's share into beta is still active here (run before the dismissal
    // below), so this proves the DELETE itself is workspace-scoped, not just that a
    // dismissed share was already excluded.
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
    {
      name: "user search on alpha's host never returns the beta-only owner",
      as: alphaOwner,
      host: alphaHost,
      method: "GET",
      path: `/api/users/search?calendarId=${alphaCal.id}&q=beta-owner`,
      expectStatus: 200,
      expectBody: (body) => Array.isArray(body) && body.length === 0,
    },
    {
      name: "user search on alpha's host finds an alpha member",
      as: alphaOwner,
      host: alphaHost,
      method: "GET",
      path: `/api/users/search?calendarId=${alphaCal.id}&q=alpha-member`,
      expectStatus: 200,
      expectBody: (body) =>
        Array.isArray(body) &&
        body.length === 1 &&
        (body[0] as { id: string }).id === seeded.users.alphaMember.id,
    },
    {
      name: "sharing alpha's calendar with the beta-only owner 404s (not a workspace member)",
      as: alphaOwner,
      host: alphaHost,
      method: "POST",
      path: `/api/calendars/${alphaCal.id}/shares`,
      body: { userId: betaOwner.id, bundleId: alphaCal.bundleId },
      expectStatus: 404,
    },
    {
      name: "sharing alpha's calendar with an alpha member succeeds",
      as: alphaOwner,
      host: alphaHost,
      method: "POST",
      path: `/api/calendars/${alphaCal.id}/shares`,
      body: { userId: seeded.users.alphaMember.id, bundleId: alphaCal.bundleId },
      expectStatus: 201,
    },
    // Admin routes stay instance-wide: the admin is a member of no workspace at all.
    {
      name: "admin transfer of alpha's calendar to the beta-only owner is refused",
      as: seeded.users.admin,
      host: alphaHost,
      method: "POST",
      path: `/api/admin/calendars/${alphaCal.id}/transfer`,
      body: { newOwnerId: betaOwner.id },
      expectStatus: 400,
    },
    {
      name: "admin transfer of alpha's calendar back to its alpha owner is allowed, even via beta's host",
      as: seeded.users.admin,
      host: betaHost,
      method: "POST",
      path: `/api/admin/calendars/${alphaCal.id}/transfer`,
      body: { newOwnerId: alphaOwner.id },
      expectStatus: 200,
    },
    {
      name: "admin bulk transfer across workspaces to an alpha-only owner is refused",
      as: seeded.users.admin,
      host: alphaHost,
      method: "POST",
      path: "/api/admin/calendars/bulk-transfer",
      body: { calendarIds: [alphaCal.id, betaCal.id], newOwnerId: alphaOwner.id },
      expectStatus: 400,
    },
    {
      name: "admin bulk transfer of alpha's calendar back to its alpha owner is allowed",
      as: seeded.users.admin,
      host: alphaHost,
      method: "POST",
      path: "/api/admin/calendars/bulk-transfer",
      body: { calendarIds: [alphaCal.id], newOwnerId: alphaOwner.id },
      expectStatus: 200,
    },
    {
      name: "beta's calendar still belongs to the beta owner after the refused bulk transfer",
      as: betaOwner,
      host: betaHost,
      method: "GET",
      path: `/api/calendars/${betaCal.id}`,
      expectStatus: 200,
    },
    // After the transfers above alpha's calendar is back with alphaOwner, whose feed this is.
    {
      name: "alpha's feed is served on alpha's host",
      as: "anonymous",
      host: alphaHost,
      method: "GET",
      path: `/api/feed/${seeded.tokens.alphaFeed}.ics`,
      expectStatus: 200,
    },
    { ...feedNotFound, name: "alpha's feed 404s on beta's host", host: betaHost, path: `/api/feed/${seeded.tokens.alphaFeed}.ics` },
    { ...feedNotFound, name: "alpha's feed 404s on the portal", host: PORTAL_HOST, path: `/api/feed/${seeded.tokens.alphaFeed}.ics` },
    { ...feedNotFound, name: "an unknown feed token 404s the same way on alpha's host", host: alphaHost, path: "/api/feed/does-not-exist.ics" },
    ...announcementRows(seeded),
    ...auditLogRows(seeded),
    ...publicCalendarRows(seeded),
  ];
}

function publicCalendarRows(seeded: SeedData): MatrixRow[] {
  const alphaHost = `alpha.${BASE_DOMAIN}`;
  const betaHost = `beta.${BASE_DOMAIN}`;
  const { alpha: alphaPublic, beta: betaPublic } = seeded.publicCalendars;
  const nonMember = seeded.users.noMembership;
  const listIds = (body: unknown): string[] =>
    Array.isArray(body) ? body.map((c: { id: string }) => c.id) : [];
  const availableIds = (body: unknown): string[] =>
    ((body as { available?: Array<{ id: string }> })?.available ?? []).map((c) => c.id);
  const onlyIds = (ids: string[], allowed: string[]) => ids.every((id) => allowed.includes(id));

  return [
    {
      name: "proxy guest gate lets an anonymous visitor into alpha (guest access on)",
      as: "anonymous",
      host: alphaHost,
      method: "GET",
      path: "/",
      expectStatus: 200,
    },
    {
      name: "proxy guest gate sends an anonymous visitor on beta (guest access off) to login",
      as: "anonymous",
      host: betaHost,
      method: "GET",
      path: "/",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        !!location && new URL(location, `http://${betaHost}`).pathname === "/login",
    },
    {
      name: "anonymous GET /api/calendars on alpha lists alpha's public calendar and nothing of beta's",
      as: "anonymous",
      host: alphaHost,
      method: "GET",
      path: "/api/calendars",
      expectStatus: 200,
      expectBody: (body) => {
        const ids = listIds(body);
        return ids.includes(alphaPublic) && onlyIds(ids, [alphaPublic]);
      },
    },
    {
      name: "anonymous GET /api/calendars on beta (guest access off) is sent to login",
      as: "anonymous",
      host: betaHost,
      method: "GET",
      path: "/api/calendars",
      expectStatus: [307, 308],
      expectLocation: (location) =>
        !!location && new URL(location, `http://${betaHost}`).pathname === "/login",
    },
    {
      name: "anonymous GET of beta's public calendar via alpha's host 404s",
      as: "anonymous",
      host: alphaHost,
      method: "GET",
      path: `/api/calendars/${betaPublic}`,
      expectStatus: 404,
    },
    {
      name: "alpha member's discovery lists alpha's public calendar, never beta's",
      as: seeded.users.alphaMember,
      host: alphaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => {
        const ids = availableIds(body);
        return ids.includes(alphaPublic) && !ids.includes(betaPublic);
      },
    },
    {
      name: "beta member keeps discovering beta's public calendar with guest access off",
      as: seeded.users.sharedMember,
      host: betaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => availableIds(body).includes(betaPublic),
    },
    {
      name: "non-member on beta (guest access off) discovers no public calendar",
      as: nonMember,
      host: betaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => !JSON.stringify(body).includes(betaPublic) && !JSON.stringify(body).includes(alphaPublic),
    },
    {
      name: "non-member on beta cannot subscribe to beta's public calendar",
      as: nonMember,
      host: betaHost,
      method: "POST",
      path: "/api/calendars/subscriptions",
      body: { calendarId: betaPublic },
      expectStatus: 404,
    },
    {
      name: "non-member's existing subscription does not open beta's public calendar",
      as: nonMember,
      host: betaHost,
      method: "GET",
      path: `/api/calendars/${betaPublic}`,
      // Same-workspace calendar without access: the route's usual 403, as for any member.
      expectStatus: 403,
    },
    {
      name: "non-member's existing subscription keeps beta's public calendar out of their list",
      as: nonMember,
      host: betaHost,
      method: "GET",
      path: "/api/calendars",
      expectStatus: 200,
      expectBody: (body) => !listIds(body).includes(betaPublic),
    },
    {
      name: "non-member on alpha (guest access on) discovers alpha's public calendar",
      as: nonMember,
      host: alphaHost,
      method: "GET",
      path: "/api/calendars/subscriptions",
      expectStatus: 200,
      expectBody: (body) => {
        const ids = availableIds(body);
        return ids.includes(alphaPublic) && !ids.includes(betaPublic);
      },
    },
    {
      name: "non-member on alpha can subscribe to alpha's public calendar",
      as: nonMember,
      host: alphaHost,
      method: "POST",
      path: "/api/calendars/subscriptions",
      body: { calendarId: alphaPublic },
      expectStatus: 200,
    },
    {
      name: "non-member on alpha can open the subscribed public calendar",
      as: nonMember,
      host: alphaHost,
      method: "GET",
      path: `/api/calendars/${alphaPublic}`,
      expectStatus: 200,
    },
  ];
}

function announcementRows(seeded: SeedData): MatrixRow[] {
  const { alphaOnly, betaOnly, everywhere } = seeded.announcements;
  const titles = (body: unknown): string[] =>
    ((body as { announcements?: Array<{ title: string }> })?.announcements ?? []).map((a) => a.title);
  const row = (name: string, host: string, expect: (t: string[]) => boolean): MatrixRow => ({
    name,
    as: "anonymous",
    host,
    method: "GET",
    path: "/api/announcements?placement=dashboard",
    expectStatus: 200,
    expectBody: (body) => expect(titles(body)),
  });
  return [
    row("alpha's host shows alpha's and instance-wide announcements, not beta's", `alpha.${BASE_DOMAIN}`, (t) =>
      t.includes(alphaOnly) && t.includes(everywhere) && !t.includes(betaOnly)
    ),
    row("an alpha-scoped announcement is invisible on beta's host", `beta.${BASE_DOMAIN}`, (t) =>
      t.includes(betaOnly) && t.includes(everywhere) && !t.includes(alphaOnly)
    ),
    row("the portal shows only instance-wide announcements", PORTAL_HOST, (t) =>
      t.includes(everywhere) && !t.includes(alphaOnly) && !t.includes(betaOnly)
    ),
  ];
}

function auditLogRows(seeded: SeedData): MatrixRow[] {
  const { alpha, beta, instance } = seeded.auditActions;
  const actions = (body: unknown): string[] =>
    ((body as { logs?: Array<{ action: string }> })?.logs ?? []).map((l) => l.action);
  return [
    {
      name: "alpha's activity log shows alpha and instance-level entries but not beta's",
      as: seeded.users.alphaOwner,
      host: `alpha.${BASE_DOMAIN}`,
      method: "GET",
      path: "/api/activity-logs?limit=100",
      expectStatus: 200,
      expectBody: (body) => {
        const a = actions(body);
        return a.includes(alpha) && a.includes(instance) && !a.includes(beta);
      },
    },
  ];
}

/** Rows written by logAuditEvent itself during the stages above, checked straight in the DB. */
async function checkAuditWorkspaceResolution(seeded: SeedData): Promise<void> {
  console.log("\nStage 2c: audit-log workspace resolution");
  // logAuditEvent inserts in a microtask after the response; give the last writes a moment.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const alphaCalId = seeded.calendars.alpha.id;
  const calendarRows = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, alphaCalId));
  check(
    `every audit row naming alpha's calendar is stamped with alpha's workspace (${calendarRows.length} rows)`,
    calendarRows.length > 0 && calendarRows.every((r) => r.workspaceId === seeded.workspaces.alpha.id)
  );
  const invalidToken = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, "calendar_token_invalid"));
  check(
    "a proxy audit row without a calendar falls back to the request host's workspace",
    invalidToken.length > 0 &&
      invalidToken.every((r) =>
        [seeded.workspaces.alpha.id, seeded.workspaces.beta.id].includes(r.workspaceId ?? "")
      ) &&
      invalidToken.some((r) => r.workspaceId === seeded.workspaces.beta.id)
  );
}

// Stateful (the grant cookie from one response feeds the next), so kept out of the matrix.
// Share-token requests share one 10/min IP bucket ("token-validation"): keep this stage under it.
async function checkShareTokens(seeded: SeedData): Promise<void> {
  console.log("\nStage 2b: share links vs. workspace");
  const alphaHost = `alpha.${BASE_DOMAIN}`;
  const betaHost = `beta.${BASE_DOMAIN}`;
  const alphaCalId = seeded.calendars.alpha.id;
  const grantCookie = (res: HttpResponse): string | null =>
    (res.headers["set-cookie"] ?? []).find((c) => c.startsWith("calendar_access_tokens=")) ?? null;
  const landing = (res: HttpResponse) => {
    const url = new URL(res.headers.location ?? "", "http://placeholder");
    return `${res.status} ${url.pathname}${url.search}`;
  };
  const share = (token: string, host: string) => httpRequest(`/share/token/${token}`, "GET", { host });
  const tryCheck = async (name: string, fn: () => Promise<boolean>) => {
    try {
      check(name, await fn());
    } catch (error) {
      check(`${name} (threw: ${error instanceof Error ? error.message : String(error)})`, false);
    }
  };

  let grant: string | null = null;
  await tryCheck("alpha share link on alpha's host redirects to the calendar and sets a host-only grant", async () => {
    const res = await share(seeded.tokens.alphaShare, alphaHost);
    const cookie = grantCookie(res);
    console.log(`        -> ${landing(res)}`);
    grant = cookie ? cookie.split(";")[0] : null;
    return landing(res) === `307 /?id=${alphaCalId}` && !!cookie && !/;\s*domain=/i.test(cookie);
  });

  let unknownOnBeta = "";
  await tryCheck("an unknown share token on beta's host redirects home without a grant", async () => {
    const res = await share("does-not-exist", betaHost);
    unknownOnBeta = landing(res);
    return unknownOnBeta === "307 /" && !grantCookie(res);
  });
  await tryCheck("alpha share link on beta's host looks exactly like an unknown token", async () => {
    const res = await share(seeded.tokens.alphaShare, betaHost);
    return landing(res) === unknownOnBeta && !grantCookie(res);
  });
  await tryCheck("a revoked alpha share link on alpha's host looks exactly like an unknown token", async () => {
    const res = await share(seeded.tokens.alphaShareRevoked, alphaHost);
    return landing(res) === unknownOnBeta && !grantCookie(res);
  });

  // Fresh user: the matrix above already shares alpha's calendar with alphaMember.
  const grantHolder = await seedUser("grant-holder@tenancy.test");
  await seedMemberships(seeded.workspaces.alpha.id, [[grantHolder, "member"]]);
  const withGrant = async (as: SeedUser, host: string, path: string, useGrant: boolean) => {
    const session = await signIn(as.email, as.password, host);
    const cookie = useGrant && grant ? `${session}; ${grant}` : session;
    return httpRequest(path, "GET", { host, cookie });
  };
  await tryCheck("control: a fresh alpha member without the grant cannot open alpha's calendar", async () =>
    (await withGrant(grantHolder, alphaHost, `/api/calendars/${alphaCalId}`, false)).status !== 200
  );
  await tryCheck("the grant opens alpha's calendar for that member on alpha's host", async () =>
    !!grant && (await withGrant(grantHolder, alphaHost, `/api/calendars/${alphaCalId}`, true)).status === 200
  );
  await tryCheck("the same grant replayed on beta's host 404s alpha's calendar", async () =>
    !!grant && (await withGrant(seeded.users.betaOwner, betaHost, `/api/calendars/${alphaCalId}`, true)).status === 404
  );
  await tryCheck("the same grant replayed on beta's host keeps alpha's calendar out of the list", async () => {
    if (!grant) return false;
    const res = await withGrant(seeded.users.betaOwner, betaHost, "/api/calendars", true);
    const list = JSON.parse(res.text) as Array<{ id: string }>;
    return res.status === 200 && list.length > 0 && !list.some((c) => c.id === alphaCalId);
  });
}

// A foreign id must be indistinguishable from one that never existed: same status, same body.
async function checkForeignVsMissing(seeded: SeedData): Promise<void> {
  console.log("\nStage 2d: foreign vs. nonexistent ids look identical");
  const alphaHost = `alpha.${BASE_DOMAIN}`;
  const beta = seeded.calendars.beta;
  const missing = () => crypto.randomUUID();
  const send = async (method: string, path: string, body?: unknown) => {
    const res = await httpRequest(
      path,
      method,
      {
        host: alphaHost,
        origin: `http://${alphaHost}`,
        cookie: await signIn(seeded.users.alphaOwner.email, seeded.users.alphaOwner.password, alphaHost),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body !== undefined ? JSON.stringify(body) : undefined
    );
    return { status: res.status, text: res.text };
  };
  const cases: Array<[string, string, (cal: string, child: string) => string, string, unknown?]> = [
    ["PATCH", "tokens/[tokenId]", (c, t) => `/api/calendars/${c}/tokens/${t}`, seeded.betaChildren.tokenId, { isActive: false }],
    ["DELETE", "tokens/[tokenId]", (c, t) => `/api/calendars/${c}/tokens/${t}`, seeded.betaChildren.tokenId],
    ["GET", "bundles", (c) => `/api/calendars/${c}/bundles`, ""],
    ["PATCH", "bundles/[bundleId]", (c, b) => `/api/calendars/${c}/bundles/${b}`, beta.bundleId, { name: "pwned" }],
    ["DELETE", "bundles/[bundleId]", (c, b) => `/api/calendars/${c}/bundles/${b}`, beta.bundleId],
    ["GET", "custom-fields", (c) => `/api/calendars/${c}/custom-fields`, ""],
    ["PATCH", "custom-fields/[fieldId]", (c, f) => `/api/calendars/${c}/custom-fields/${f}`, seeded.betaChildren.customFieldId, { label: "pwned" }],
    ["DELETE", "custom-fields/[fieldId]", (c, f) => `/api/calendars/${c}/custom-fields/${f}`, seeded.betaChildren.customFieldId],
    ["GET", "members", (c) => `/api/calendars/${c}/members`, ""],
    ["GET", "feed-token", (c) => `/api/calendars/${c}/feed-token`, ""],
    ["GET", "tokens", (c) => `/api/calendars/${c}/tokens`, ""],
  ];
  for (const [method, label, path, child, body] of cases) {
    try {
      const foreign = await send(method, path(beta.id, child), body);
      const absent = await send(method, path(missing(), missing()), body);
      console.log(`        ${method} ${label}: foreign ${foreign.status} ${foreign.text} | missing ${absent.status} ${absent.text}`);
      check(
        `${method} calendars/[id]/${label}: beta's ids via alpha's host match nonexistent ones`,
        foreign.status >= 400 && foreign.status === absent.status && foreign.text === absent.text
      );
    } catch (error) {
      check(`${method} calendars/[id]/${label} (threw: ${error instanceof Error ? error.message : String(error)})`, false);
    }
  }
}

// The organization plugin's own mutation endpoints are disabled everywhere (see lib/auth.ts);
// membership changes go through our own routes instead.
async function checkWorkspaceSlugs(seeded: SeedData): Promise<void> {
  console.log("\nStage 2e: organization plugin paths are disabled");
  const alphaHost = `alpha.${BASE_DOMAIN}`;
  const alphaId = seeded.workspaces.alpha.id;
  const orgCall = async (as: SeedUser, endpoint: string, body: unknown) => {
    const res = await httpRequest(
      `/api/auth/organization/${endpoint}`,
      "POST",
      {
        host: alphaHost,
        origin: `http://${alphaHost}`,
        cookie: await signIn(as.email, as.password, alphaHost),
        "content-type": "application/json",
      },
      JSON.stringify(body)
    );
    console.log(`        ${endpoint} ${JSON.stringify(body)} -> ${res.status}`);
    return res.status;
  };
  const alphaRow = async () =>
    (await db.select().from(organization).where(eq(organization.id, alphaId)))[0];
  const tryCheck = async (name: string, fn: () => Promise<boolean>) => {
    try {
      check(name, await fn());
    } catch (error) {
      check(`${name} (threw: ${error instanceof Error ? error.message : String(error)})`, false);
    }
  };
  const owner = seeded.users.alphaOwner;
  const admin = seeded.users.admin;

  await tryCheck("organization/update is disabled (404)", async () =>
    (await orgCall(owner, "update", { organizationId: alphaId, data: { slug: "admin" } })) === 404
  );
  await tryCheck("alpha's slug is unchanged in the DB", async () => (await alphaRow())?.slug === "alpha");
  await tryCheck("organization/leave is disabled (404)", async () =>
    (await orgCall(owner, "leave", { organizationId: alphaId })) === 404
  );
  await tryCheck("organization/remove-member is disabled (404)", async () =>
    (await orgCall(admin, "remove-member", { organizationId: alphaId, memberIdOrEmail: owner.email })) === 404
  );
  await tryCheck("organization/invite-member is disabled (404)", async () =>
    (await orgCall(owner, "invite-member", { organizationId: alphaId, email: "x@tenancy.test", role: "member" })) === 404
  );
}

// Destructive, so kept out of the shared matrix: every case seeds its own workspace and users.
async function deleteAccount(account: SeedUser, host: string): Promise<number> {
  const status = await deleteAccountRequest(account, host);
  console.log(`        delete-account ${account.email} via ${host} -> ${status}`);
  return status;
}

async function deleteAccountRequest(account: SeedUser, host: string): Promise<number> {
  const res = await httpRequest(
    "/api/auth/delete-account",
    "DELETE",
    {
      host,
      origin: `http://${host}`,
      cookie: await signIn(account.email, account.password, host),
      "content-type": "application/json",
    },
    JSON.stringify({ password: account.password })
  );
  return res.status;
}

export async function seedMemberships(
  workspaceId: string,
  entries: Array<[SeedUser, "owner" | "member"]>
): Promise<void> {
  await db.insert(member).values(
    entries.map(([u, role]) => ({ id: crypto.randomUUID(), organizationId: workspaceId, userId: u.id, role }))
  );
}

async function checkAccountDeletion(seeded: SeedData): Promise<void> {
  console.log("\nStage 3: account deletion vs. workspace membership");
  const tryCheck = async (name: string, fn: () => Promise<boolean>) => {
    try {
      check(name, await fn());
    } catch (error) {
      check(`${name} (threw: ${error instanceof Error ? error.message : String(error)})`, false);
    }
  };

  // Only member of a workspace: the workspace and everything in it goes with the account,
  // while its audit history survives as instance-level rows.
  const solo = await seedWorkspace("solo-delete-check");
  const soloHost = `${solo.slug}.${BASE_DOMAIN}`;
  const soloOwner = await seedUser("solo-owner@tenancy.test");
  await seedMemberships(solo.id, [[soloOwner, "owner"]]);
  const soloCalendarId = crypto.randomUUID();
  await db.insert(calendars).values({ id: soloCalendarId, name: "Solo", ownerId: null, workspaceId: solo.id });
  const [soloAnnouncement] = await db
    .insert(announcements)
    .values({ title: "Solo notice", workspaceId: solo.id })
    .returning({ id: announcements.id });
  const [soloAudit] = await db
    .insert(auditLogs)
    .values({ action: "tenancy.check", workspaceId: solo.id })
    .returning({ id: auditLogs.id });

  await tryCheck("solo workspace owner can delete their account", async () =>
    (await deleteAccount(soloOwner, soloHost)) === 200
  );
  await tryCheck("the solo workspace is gone after that deletion", async () =>
    (await db.select().from(organization).where(eq(organization.id, solo.id))).length === 0
  );
  await tryCheck("the solo workspace's ownerless calendar is gone (workspace cascade)", async () =>
    (await db.select().from(calendars).where(eq(calendars.id, soloCalendarId))).length === 0
  );
  await tryCheck("the solo workspace's announcement is gone", async () =>
    (await db.select().from(announcements).where(eq(announcements.id, soloAnnouncement.id))).length === 0
  );
  await tryCheck("the solo workspace's audit row survives with a NULL workspace", async () => {
    const [row] = await db.select().from(auditLogs).where(eq(auditLogs.id, soloAudit.id));
    return !!row && row.workspaceId === null;
  });
  await tryCheck("the deleted workspace's host now 404s (slug cache invalidated)", async () =>
    (await httpRequest("/api/workspace", "GET", { host: soloHost })).status === 404
  );

  // Only owner of a workspace that has other members: blocked for self-service and admin alike.
  const shared = await seedWorkspace("shared-delete-check");
  const sharedHost = `${shared.slug}.${BASE_DOMAIN}`;
  const blockedOwner = await seedUser("blocked-owner@tenancy.test");
  const otherMember = await seedUser("other-member@tenancy.test");
  await seedMemberships(shared.id, [[blockedOwner, "owner"], [otherMember, "member"]]);

  await tryCheck("sole owner of a workspace with other members is blocked from deleting", async () =>
    (await deleteAccount(blockedOwner, sharedHost)) === 409
  );
  await tryCheck("admin delete of that sole owner is blocked too", async () => {
    const res = await httpRequest(`/api/admin/users/${blockedOwner.id}`, "DELETE", {
      host: sharedHost,
      origin: `http://${sharedHost}`,
      cookie: await signIn(seeded.users.admin.email, seeded.users.admin.password, sharedHost),
    });
    console.log(`        admin delete ${blockedOwner.email} -> ${res.status} ${res.text}`);
    return res.status === 409;
  });
  await tryCheck("the blocked owner and their workspace still exist", async () => {
    const users = await db.select().from(user).where(eq(user.id, blockedOwner.id));
    const orgs = await db.select().from(organization).where(eq(organization.id, shared.id));
    return users.length === 1 && orgs.length === 1;
  });
  await tryCheck("a plain member of a shared workspace can delete their account", async () =>
    (await deleteAccount(otherMember, sharedHost)) === 200
  );
  await tryCheck("the shared workspace survives a member's deletion", async () =>
    (await db.select().from(organization).where(eq(organization.id, shared.id))).length === 1
  );

  // A co-owner is not the only owner, so leaving is allowed and the workspace stays.
  const coOwned = await seedWorkspace("co-owned-delete-check");
  const coOwnerA = await seedUser("co-owner-a@tenancy.test");
  const coOwnerB = await seedUser("co-owner-b@tenancy.test");
  await seedMemberships(coOwned.id, [[coOwnerA, "owner"], [coOwnerB, "owner"]]);
  await tryCheck("a co-owner can delete their account", async () =>
    (await deleteAccount(coOwnerA, `${coOwned.slug}.${BASE_DOMAIN}`)) === 200
  );
  await tryCheck("the co-owned workspace survives", async () =>
    (await db.select().from(organization).where(eq(organization.id, coOwned.id))).length === 1
  );
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

  await checkShareTokens(seeded);

  await checkAuditWorkspaceResolution(seeded);

  await checkForeignVsMissing(seeded);

  await checkWorkspaceSlugs(seeded);

  await checkAccountDeletion(seeded);

  const { runOnboardingChecks } = await import("./tenancy-onboarding-checks");
  await runOnboardingChecks({
    check, httpRequest, signIn, seedUser, seedCalendar, seedFeedToken, seedMemberships,
    baseDomain: BASE_DOMAIN, portalHost: PORTAL_HOST, seeded,
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
