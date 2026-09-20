#!/usr/bin/env node
// Runs the canned reports in queries/ against the D1 database and prints them.
//
//   npm run stats                    every report, against the deployed database
//   npm run stats -- versions sizes  only those two
//   npm run stats -- --local         against the local `wrangler dev` database
//
// Requires `npx wrangler login` for the remote database.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const queriesDir = join(root, "queries");

const args = process.argv.slice(2);
const local = args.includes("--local");
const wanted = args.filter((arg) => !arg.startsWith("--"));

const config = readFileSync(join(root, "wrangler.toml"), "utf8");
const databaseName = config.match(/^\s*database_name\s*=\s*"([^"]+)"/m)?.[1];
if (!databaseName) {
  console.error("No database_name found in wrangler.toml.");
  process.exit(1);
}

const available = readdirSync(queriesDir)
  .filter((file) => file.endsWith(".sql"))
  .map((file) => file.replace(/\.sql$/, ""))
  .sort();

const unknown = wanted.filter((name) => !available.includes(name));
if (unknown.length > 0) {
  console.error(`Unknown report(s): ${unknown.join(", ")}`);
  console.error(`Available: ${available.join(", ")}`);
  process.exit(1);
}

const reports = wanted.length > 0 ? wanted : available;
let failed = false;

for (const name of reports) {
  // --command, not --file: against a remote database wrangler treats a file as an
  // import and reports only statistics, never the selected rows. Comment lines are
  // stripped because a value starting with "--" is parsed as further CLI flags.
  const sql = readFileSync(join(queriesDir, `${name}.sql`), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();

  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      databaseName,
      local ? "--local" : "--remote",
      "--command",
      sql,
      "--json",
    ],
    { cwd: root, encoding: "utf8" },
  );

  console.log(`\n── ${name} ${"─".repeat(Math.max(0, 60 - name.length))}`);

  // A rejected query is reported as a `{ error }` object on stdout, so stdout is
  // worth parsing even when the exit code is non-zero -- stderr only carries noise.
  const start = result.stdout?.search(/[[{]/) ?? -1;
  let parsed;
  if (start !== -1) {
    try {
      parsed = JSON.parse(result.stdout.slice(start));
    } catch {
      parsed = undefined;
    }
  }

  if (parsed && !Array.isArray(parsed)) {
    failed = true;
    console.error(parsed.error?.text ?? JSON.stringify(parsed));
    continue;
  }

  if (!parsed) {
    failed = true;
    console.error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        `wrangler exited with ${result.status}`,
    );
    continue;
  }

  const rows = parsed.flatMap((entry) => entry.results ?? []);
  if (rows.length === 0) {
    console.log("(no rows)");
  } else {
    console.table(rows);
  }
}

process.exit(failed ? 1 : 0);
