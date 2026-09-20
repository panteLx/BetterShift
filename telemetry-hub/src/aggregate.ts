export interface DistributionEntry {
  value: string;
  instances: number;
  share: number;
  /** Set only on the size-guard remainder entry; see MAX_DISTRIBUTION_ENTRIES. */
  remainder?: true;
}

export interface VersionEntry extends DistributionEntry {
  devInstances: number;
}

export interface HistoryPoint {
  day: string;
  instances: number;
}

export interface PublicAggregate {
  computedAt: string;
  instances: { total: number; activeLast7Days: number; newLast30Days: number };
  history: HistoryPoint[];
  versions: VersionEntry[];
  environment: Record<string, DistributionEntry[]>;
  configuration: Record<string, DistributionEntry[]>;
  sizes: Record<string, DistributionEntry[]>;
  features: Record<string, DistributionEntry[]>;
  customFieldTypes: DistributionEntry[];
  health: { avgUptimeHours: number; instancesWithSyncFailures: number };
}

const ACTIVE_WINDOW_DAYS = 30;
const HISTORY_DAYS = 90;
// Payload string fields are unbounded and the hub is unauthenticated.
const MAX_VALUE_LENGTH = 64;
// SIZE GUARD, NOT A PRIVACY RULE: a single ping can carry arbitrarily many
// distinct values (features.customFields.types is an unbounded string array), and
// every distinct value becomes a row in /data.json and a bar on the page. The long
// tail past this many entries is summed into one remainder entry so both stay
// bounded. Nothing is hidden for being rare — small counts are published as-is.
const MAX_DISTRIBUTION_ENTRIES = 25;

const remainderLabel = (values: number): string => `other (${values} more values)`;

const iso = (now: Date, daysAgo: number): string =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

const truncate = (value: string): string =>
  value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;

interface RawGroup {
  key: string;
  value: string | number | null;
  instances: number;
}

// The GROUP BY queries have no ORDER BY, so entries tied on count could otherwise
// straddle the cap differently between runs — by name one hour, in the remainder
// the next. The value breaks the tie deterministically.
const byCountThenValue = (
  a: { value: string; instances: number },
  b: { value: string; instances: number },
): number => b.instances - a.instances || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0);

const share = (instances: number, base: number): number =>
  base > 0 ? Math.round((instances / base) * 10_000) / 10_000 : 0;

/** Sorts by size, caps the long tail (see MAX_DISTRIBUTION_ENTRIES), adds shares. */
function collapse(rows: RawGroup[], base: number): DistributionEntry[] {
  const sorted = rows
    .map((row) => ({ value: truncate(String(row.value)), instances: row.instances }))
    .sort(byCountThenValue);

  const kept = sorted.slice(0, MAX_DISTRIBUTION_ENTRIES);
  const tail = sorted.slice(MAX_DISTRIBUTION_ENTRIES);

  const entries: DistributionEntry[] = kept.map((row) => ({
    value: row.value,
    instances: row.instances,
    share: share(row.instances, base),
  }));

  if (tail.length > 0) {
    const instances = tail.reduce((sum, row) => sum + row.instances, 0);
    entries.push({
      value: remainderLabel(tail.length),
      instances,
      share: share(instances, base),
      remainder: true,
    });
  }
  return entries;
}

/** Same tail cap as collapse(), plus a dev-instance count carried per entry. */
function buildVersions(
  rows: Array<{ value: string; instances: number; dev_instances: number }>,
  base: number,
): VersionEntry[] {
  const sorted = rows
    .map((row) => ({
      value: truncate(row.value),
      instances: row.instances,
      devInstances: Number(row.dev_instances ?? 0),
    }))
    .sort(byCountThenValue);

  const kept = sorted.slice(0, MAX_DISTRIBUTION_ENTRIES);
  const tail = sorted.slice(MAX_DISTRIBUTION_ENTRIES);

  const entries: VersionEntry[] = kept.map((row) => ({
    value: row.value,
    instances: row.instances,
    share: share(row.instances, base),
    devInstances: row.devInstances,
  }));

  if (tail.length > 0) {
    const instances = tail.reduce((sum, row) => sum + row.instances, 0);
    entries.push({
      value: remainderLabel(tail.length),
      instances,
      share: share(instances, base),
      devInstances: tail.reduce((sum, row) => sum + row.devInstances, 0),
      remainder: true,
    });
  }
  return entries;
}

function groupByKey(rows: RawGroup[], base: number): Record<string, DistributionEntry[]> {
  const buckets = new Map<string, RawGroup[]>();
  for (const row of rows) {
    const list = buckets.get(row.key) ?? [];
    list.push(row);
    buckets.set(row.key, list);
  }
  const out: Record<string, DistributionEntry[]> = {};
  for (const [key, list] of buckets) out[key] = collapse(list, base);
  return out;
}

// Unpivots columns into (key, value) pairs, reading the already-filtered `active`
// CTE (see buildAggregate) instead of the view directly. D1 caps a compound SELECT
// at five terms, so UNION ALL is not an option for the columns themselves.
const unpivot = (pairs: string) => `
  SELECT t.key AS key, t.value AS value, COUNT(*) AS instances
  FROM active AS p, json_each(json_object(${pairs})) AS t
  GROUP BY t.key, t.value`;

// Wraps a (key?, value, instances[, extra]) query as a JSON array so it can sit
// in its own scalar-subquery column of the single mega-query below. That keeps
// every one of these reports reading the same MATERIALIZED `active` CTE instead
// of each re-deriving "the latest ping per instance" from the full ping history.
const asJsonArray = (columns: string, innerSql: string) =>
  `(SELECT COALESCE(json_group_array(json_object(${columns})), '[]') FROM (${innerSql}))`;

const VERSIONS_SQL = `
  SELECT app_version AS value, COUNT(*) AS instances,
         SUM(CASE WHEN app_is_dev = 1 THEN 1 ELSE 0 END) AS dev_instances
  FROM active GROUP BY app_version`;

const FIELD_TYPES_SQL = `
  SELECT t.value AS value, COUNT(DISTINCT p.id) AS instances
  FROM active AS p, json_each(p.features_custom_field_types) AS t
  GROUP BY t.value`;

/**
 * Every report below used to read the `latest_pings` view independently (nine
 * references in total), and the view itself has no time bound: each reference
 * re-scanned the entire ping history to find each instance's newest row before
 * filtering it down to the active window. At the README's own worked example
 * (~36,000 rows/year) that is roughly 9x the necessary reads per cron run.
 *
 * Instead, `active` is materialized exactly once (one scan of `instance_pings`,
 * enforced with the MATERIALIZED hint so SQLite doesn't just inline the CTE per
 * reference) and every report reads that bounded, already-filtered result as a
 * scalar subquery of one row -- one statement, one full scan, regardless of how
 * many breakdowns are computed from it.
 */
const MEGA_SQL = `
  WITH active AS MATERIALIZED (SELECT * FROM latest_pings WHERE received_at >= ?1)
  SELECT
    (SELECT COUNT(*) FROM active) AS total,
    (SELECT COUNT(*) FROM active WHERE received_at >= ?2) AS active_7d,
    (SELECT COUNT(*) FROM (
       SELECT instance_id FROM instance_pings
       WHERE instance_id IS NOT NULL
       GROUP BY instance_id HAVING MIN(received_at) >= ?1
    )) AS new_30d,
    ${asJsonArray("'value', value, 'instances', instances, 'dev_instances', dev_instances", VERSIONS_SQL)} AS versions_json,
    ${asJsonArray(
      "'key', key, 'value', value, 'instances', instances",
      unpivot(
        `'node', p.runtime_node, 'platform', p.runtime_platform, 'arch', p.runtime_arch,
         'sqlite', p.runtime_sqlite, 'timezone', p.runtime_timezone`,
      ),
    )} AS environment_json,
    ${asJsonArray(
      "'key', key, 'value', value, 'instances', instances",
      unpivot(
        `'auth_enabled', p.config_auth_enabled, 'guest_access', p.config_guest_access,
         'registration_open', p.config_registration_open,
         'update_check_enabled', p.config_update_check_enabled,
         'default_locale', p.config_default_locale,
         'rate_limit_overrides', p.config_rate_limit_overrides`,
      ),
    )} AS configuration_json,
    ${asJsonArray(
      "'key', key, 'value', value, 'instances', instances",
      unpivot(
        `'users', p.scale_users, 'calendars', p.scale_calendars, 'shifts', p.scale_shifts,
         'presets', p.scale_presets, 'notes', p.scale_notes, 'bundles', p.scale_bundles,
         'shares', p.scale_shares, 'access_tokens', p.scale_access_tokens,
         'signups', p.scale_signups`,
      ),
    )} AS sizes_json,
    ${asJsonArray(
      "'key', key, 'value', value, 'instances', instances",
      unpivot(
        `'external_syncs', p.features_external_syncs,
         'calendar_view_overrides', p.features_calendar_view_overrides,
         'custom_fields_count', p.features_custom_fields_count,
         'archived_presets', p.features_archived_presets,
         'split_shifts', p.features_split_shifts`,
      ),
    )} AS features_json,
    ${asJsonArray("'value', value, 'instances', instances", FIELD_TYPES_SQL)} AS field_types_json,
    (SELECT ROUND(AVG(health_uptime_hours), 1) FROM active) AS avg_uptime,
    (SELECT SUM(CASE WHEN health_sync_failures_24h > 0 THEN 1 ELSE 0 END) FROM active) AS with_failures`;

interface VersionJsonRow {
  value: string;
  instances: number;
  dev_instances: number;
}

// Falling back to [] would otherwise publish an all-zeros aggregate with nothing
// in the logs, so every unexpected shape is reported before it is swallowed.
function parseJsonArray<T>(value: unknown): T[] {
  if (typeof value !== "string") {
    console.error(`Aggregate column was ${typeof value}, expected a JSON string`);
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as T[];
    console.error("Aggregate column parsed to a non-array");
    return [];
  } catch {
    console.error("Aggregate column is not valid JSON");
    return [];
  }
}

export async function buildAggregate(db: D1Database, now: Date = new Date()): Promise<PublicAggregate> {
  const activeCutoff = iso(now, ACTIVE_WINDOW_DAYS);
  const weekCutoff = iso(now, 7);
  const historyCutoff = iso(now, HISTORY_DAYS).slice(0, 10);

  const [mega, history] = await db.batch([
    db.prepare(MEGA_SQL).bind(activeCutoff, weekCutoff),
    db
      .prepare(
        `SELECT ping_day AS day, COUNT(DISTINCT COALESCE(instance_id, 'anon:' || id)) AS instances
         FROM instance_pings WHERE ping_day >= ?1 GROUP BY ping_day ORDER BY day`,
      )
      .bind(historyCutoff),
  ]);

  const megaRow = (mega.results[0] ?? {}) as Record<string, unknown>;
  const base = Number(megaRow.total ?? 0);

  const instances = {
    total: base,
    activeLast7Days: Number(megaRow.active_7d ?? 0),
    newLast30Days: Number(megaRow.new_30d ?? 0),
  };

  const versionRows = parseJsonArray<VersionJsonRow>(megaRow.versions_json);

  return {
    computedAt: now.toISOString(),
    instances,
    history: history.results as unknown as HistoryPoint[],
    versions: buildVersions(
      versionRows.map((r) => ({
        value: r.value,
        instances: Number(r.instances),
        dev_instances: Number(r.dev_instances),
      })),
      base,
    ),
    environment: groupByKey(parseJsonArray<RawGroup>(megaRow.environment_json), base),
    configuration: groupByKey(parseJsonArray<RawGroup>(megaRow.configuration_json), base),
    sizes: groupByKey(parseJsonArray<RawGroup>(megaRow.sizes_json), base),
    features: groupByKey(parseJsonArray<RawGroup>(megaRow.features_json), base),
    customFieldTypes: collapse(
      parseJsonArray<RawGroup>(megaRow.field_types_json).map((r) => ({ ...r, key: "types" })),
      base,
    ),
    health: {
      avgUptimeHours: Number(megaRow.avg_uptime ?? 0),
      instancesWithSyncFailures: Number(megaRow.with_failures ?? 0),
    },
  };
}

export async function storeAggregate(db: D1Database, aggregate: PublicAggregate): Promise<void> {
  const result = await db
    .prepare("INSERT OR REPLACE INTO aggregates (key, json, computed_at) VALUES ('public', ?1, ?2)")
    .bind(JSON.stringify(aggregate), aggregate.computedAt)
    .run();
  if (!result.success) throw new Error("Aggregate write did not report success");
}

export async function readAggregate(db: D1Database): Promise<PublicAggregate | null> {
  let row: { json: string } | null;
  try {
    row = await db.prepare("SELECT json FROM aggregates WHERE key = 'public'").first<{ json: string }>();
  } catch (error) {
    // A D1 read error (e.g. the table is missing on an un-migrated database)
    // degrades to the empty state instead of a 500; see src/page.ts / src/index.ts.
    console.error(error instanceof Error ? error.message : "Aggregate read failed");
    return null;
  }
  if (!row) return null;
  try {
    return JSON.parse(row.json) as PublicAggregate;
  } catch {
    // A corrupt row is treated exactly like a missing one.
    return null;
  }
}
