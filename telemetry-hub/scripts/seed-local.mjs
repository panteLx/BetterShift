#!/usr/bin/env node
// Fills the LOCAL D1 with deterministic pings so the statistics page can be
// verified against known numbers. Never run against --remote.
//
//   npm run seed:local        add the fixture rows
//   npm run seed:local -- --reset   delete all pings first

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(join(root, "wrangler.toml"), "utf8");
const databaseName = config.match(/^\s*database_name\s*=\s*"([^"]+)"/m)?.[1];
if (!databaseName) {
  console.error("No database_name found in wrangler.toml.");
  process.exit(1);
}

const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString();
};

// 6 instances: four current, one 90 days stale, one with a unique timezone (n=1).
const fixtures = [
  { id: "inst-a", ago: 0, version: "1.4.2", dev: 0, node: "24.0.0", tz: "Europe/Berlin", users: "6-20" },
  { id: "inst-b", ago: 0, version: "1.4.2", dev: 0, node: "24.0.0", tz: "Europe/Berlin", users: "1-5" },
  { id: "inst-c", ago: 2, version: "1.4.2", dev: 0, node: "24.0.0", tz: "Europe/Berlin", users: "1-5" },
  { id: "inst-d", ago: 10, version: "1.3.0", dev: 1, node: "22.11.0", tz: "Pacific/Chatham", users: "1-5" },
  { id: "inst-e", ago: 12, version: "1.4.2", dev: 0, node: "24.0.0", tz: "Europe/Berlin", users: "1-5" },
  { id: "inst-stale", ago: 90, version: "0.9.0", dev: 0, node: "20.0.0", tz: "UTC", users: "1-5" },
];

const values = fixtures
  .map((f) => {
    const at = day(f.ago);
    return `('${at}','${at.slice(0, 10)}','${at}','${f.id}',1,'${f.version}',${f.dev},30,'${f.node}','x64','linux','3.46.0','${f.tz}',1,0,0,'de',1,0,'${f.users}','1-5','1-5','0','0','0','0','0','0','0','0','0','[]',0,0,100.0,1,0)`;
  })
  .join(",\n");

const columns = [
  "received_at", "ping_day", "sent_at", "instance_id", "schema_version",
  "app_version", "app_is_dev", "app_migrations",
  "runtime_node", "runtime_arch", "runtime_platform", "runtime_sqlite", "runtime_timezone",
  "config_auth_enabled", "config_guest_access", "config_registration_open",
  "config_default_locale", "config_update_check_enabled", "config_rate_limit_overrides",
  "scale_users", "scale_calendars", "scale_shifts", "scale_presets", "scale_notes",
  "scale_bundles", "scale_shares", "scale_access_tokens", "scale_signups",
  "features_external_syncs", "features_calendar_view_overrides",
  "features_custom_fields_count", "features_custom_field_types",
  "features_archived_presets", "features_split_shifts",
  "health_uptime_hours", "health_sync_runs_24h", "health_sync_failures_24h",
].join(", ");

const statements = [];
if (process.argv.includes("--reset")) statements.push("DELETE FROM instance_pings;");
statements.push(`INSERT INTO instance_pings (${columns}) VALUES\n${values};`);

const result = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", databaseName, "--local", "--command", statements.join("\n"), "--json"],
  { cwd: root, encoding: "utf8" },
);

if (result.status !== 0) {
  console.error(result.stdout?.trim() || result.stderr?.trim());
  process.exit(1);
}
console.log(`Seeded ${fixtures.length} pings into the local database.`);
