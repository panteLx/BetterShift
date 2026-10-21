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
  // SQLite ignores this pragma inside migrate()'s transaction; left ON, a rebuild of a
  // referenced table (0035's calendars) cascade-deletes every child row on DROP TABLE.
  sqlite.pragma("foreign_keys = OFF");
  migrate(drizzle(sqlite), {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  // Warn only: throwing here would crash-loop a container over legacy data.
  const violations = sqlite.pragma("foreign_key_check");
  if (violations.length > 0) {
    console.warn(
      `[Migrate] ${violations.length} foreign key violation(s) after migrating: ${JSON.stringify(violations.slice(0, 20))}`
    );
  }
  sqlite.pragma("foreign_keys = ON");
  console.log(`[Migrate] Schema is up to date: ${path.resolve(dbPath)}`);
} finally {
  sqlite.close();
}
