import path from "node:path";

// Shared by lib/db/index.ts, scripts/migrate.mjs and drizzle.config.ts. If these
// ever resolve differently, drizzle-kit, the migrator and the server end up
// pointed at different files, silently and with no error.
export function resolveDatabasePath() {
  return (
    process.env.DATABASE_URL?.replace("file:", "") ||
    path.join(process.cwd(), "data", "sqlite.db")
  );
}
