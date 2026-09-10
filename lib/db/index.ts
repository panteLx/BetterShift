import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { resolveDatabasePath } from "./db-path.mjs";
import path from "path";
import fs from "fs";

const dbPath = resolveDatabasePath();

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });
