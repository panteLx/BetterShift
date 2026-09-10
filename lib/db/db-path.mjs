import path from "node:path";

// Shared by lib/db/index.ts and scripts/migrate.mjs. If these two ever resolve
// differently, migrations run against one file and the server opens another,
// silently and with no error.
export function resolveDatabasePath() {
  return (
    process.env.DATABASE_URL?.replace("file:", "") ||
    path.join(process.cwd(), "data", "sqlite.db")
  );
}
