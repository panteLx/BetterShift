import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { resolveDatabasePath } from "./lib/db/db-path.mjs";

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveDatabasePath(),
  },
});
