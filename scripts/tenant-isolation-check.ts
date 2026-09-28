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
let parseWorkspaceHost: WorkspaceModule["parseWorkspaceHost"];

async function loadDbBackedModules(): Promise<void> {
  const [dbModule, schemaModule, workspaceModule] = await Promise.all([
    import("../lib/db"),
    import("../lib/db/schema"),
    import("../lib/workspace"),
  ]);
  db = dbModule.db;
  ({ organization, member, user, account } = schemaModule);
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
  };
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

  await db.insert(member).values([
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: alphaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: betaOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: alpha.id, userId: sharedMember.id, role: "member" },
    { id: crypto.randomUUID(), organizationId: beta.id, userId: sharedMember.id, role: "member" },
  ]);

  return {
    workspaces: { alpha, beta },
    users: { alphaOwner, betaOwner, sharedMember },
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
}

const sessionCookies = new Map<string, string>();

async function signIn(email: string, password: string, host: string): Promise<string> {
  const key = `${host}:${email}`;
  const cached = sessionCookies.get(key);
  if (cached) return cached;

  const res = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", host, origin: `http://${host}` },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}@${host}: ${res.status} ${await res.text()}`);
  }
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
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

    const res = await fetch(`${APP_URL}${row.path}`, {
      method: row.method,
      headers,
      body: row.body !== undefined ? JSON.stringify(row.body) : undefined,
    });
    const ok = expected.includes(res.status);
    check(`${row.name} (got ${res.status}, want ${expected.join("|")})`, ok);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(`${row.name} (want ${expected.join("|")}, threw: ${message})`, false);
    return false;
  }
}

// Later tasks push more rows onto this array (and extend seed()/SeedData for
// the fixtures those rows need) rather than replacing the matrix wholesale.
export const matrix: MatrixRow[] = [
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
];

async function main(): Promise<void> {
  await loadDbBackedModules();

  runPureChecks();

  console.log("\nSeeding two workspaces via Drizzle...");
  await seed();

  console.log("\nStage 2: HTTP isolation matrix");
  for (const row of matrix) {
    await runRow(row);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
