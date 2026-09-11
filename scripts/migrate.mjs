/**
 * Applies pending migrations. Runs as `npm run db:migrate` and as the
 * container's CMD, so the same migrator covers dev, CI and production.
 *
 * Uses drizzle-orm's migrator rather than drizzle-kit, which is a build-time
 * tool that would drag a full dev dependency tree into the runtime image.
 * The two share bookkeeping -- same __drizzle_migrations table, same
 * sha256-of-.sql hashes -- so an upgraded container replays nothing.
 *
 * Plain .mjs, not .ts like scripts/i18n-checks.ts: the runtime image ships no
 * tsx, so this has to run under bare node.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { resolveDatabasePath } from "../lib/db/db-path.mjs";

// Match `next dev`, which reads .env; the Docker image ships none. Existing env vars win.
if (fs.existsSync(".env")) process.loadEnvFile(".env");

const dbPath = resolveDatabasePath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

try {
  migrate(drizzle(sqlite), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  console.log(`[Migrate] Schema is up to date: ${path.resolve(dbPath)}`);
} finally {
  sqlite.close();
}
