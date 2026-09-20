export interface DistributionEntry {
  value: string;
  instances: number;
  share: number;
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

// A distribution value held by fewer than this many instances is folded into
// "other": with a small population, n=1 plus the other dimensions identifies.
const MIN_GROUP_SIZE = 3;
const ACTIVE_WINDOW_DAYS = 30;
const HISTORY_DAYS = 90;
// Payload string fields are unbounded and the hub is unauthenticated.
const MAX_VALUE_LENGTH = 64;

const iso = (now: Date, daysAgo: number): string =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

const truncate = (value: string): string =>
  value.length > MAX_VALUE_LENGTH ? value.slice(0, MAX_VALUE_LENGTH) : value;

interface RawGroup {
  key: string;
  value: string | number | null;
  instances: number;
}

/** Sorts by size, folds small groups into one "other" entry, adds shares. */
function collapse(rows: RawGroup[], base: number): DistributionEntry[] {
  const kept: DistributionEntry[] = [];
  let otherCount = 0;

  for (const row of rows) {
    if (row.instances < MIN_GROUP_SIZE) {
      otherCount += row.instances;
      continue;
    }
    kept.push({ value: truncate(String(row.value)), instances: row.instances, share: 0 });
  }

  // A sub-floor "other" is itself a fingerprint once read across dimensions.
  if (otherCount >= MIN_GROUP_SIZE) kept.push({ value: "other", instances: otherCount, share: 0 });

  for (const entry of kept) {
    entry.share = base > 0 ? Math.round((entry.instances / base) * 10_000) / 10_000 : 0;
  }
  return kept.sort((a, b) => b.instances - a.instances);
}

/** Same folding rule as collapse(), plus a dev-instance count carried per entry. */
function buildVersions(
  rows: Array<{ value: string; instances: number; dev_instances: number }>,
  base: number,
): VersionEntry[] {
  const kept: Array<{ value: string; instances: number; devInstances: number }> = [];
  let otherInstances = 0;
  let otherDev = 0;

  for (const row of rows) {
    const dev = Number(row.dev_instances ?? 0);
    if (row.instances < MIN_GROUP_SIZE) {
      otherInstances += row.instances;
      otherDev += dev;
      continue;
    }
    kept.push({ value: truncate(row.value), instances: row.instances, devInstances: dev });
  }

  if (otherInstances >= MIN_GROUP_SIZE) {
    kept.push({ value: "other", instances: otherInstances, devInstances: otherDev });
  }

  return kept
    .map((entry) => ({
      value: entry.value,
      instances: entry.instances,
      share: base > 0 ? Math.round((entry.instances / base) * 10_000) / 10_000 : 0,
      // A dev count below the floor would out one instance within a kept version.
      devInstances: entry.devInstances >= MIN_GROUP_SIZE ? entry.devInstances : 0,
    }))
    .sort((a, b) => b.instances - a.instances);
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

// Unpivots columns into (key, value) pairs. D1 caps a compound SELECT at five
// terms, so UNION ALL is not an option here.
const unpivot = (pairs: string) => `
  SELECT t.key AS key, t.value AS value, COUNT(*) AS instances
  FROM latest_pings AS p, json_each(json_object(${pairs})) AS t
  WHERE p.received_at >= ?1
  GROUP BY t.key, t.value`;

export async function buildAggregate(db: D1Database, now: Date = new Date()): Promise<PublicAggregate> {
  const activeCutoff = iso(now, ACTIVE_WINDOW_DAYS);
  const weekCutoff = iso(now, 7);
  const historyCutoff = iso(now, HISTORY_DAYS).slice(0, 10);

  const [totals, history, versions, environment, configuration, sizes, features, fieldTypes, health] =
    await db.batch([
      db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM latest_pings WHERE received_at >= ?1) AS total,
             (SELECT COUNT(*) FROM latest_pings WHERE received_at >= ?2) AS active_7d,
             (SELECT COUNT(*) FROM (
                SELECT instance_id FROM instance_pings
                WHERE instance_id IS NOT NULL
                GROUP BY instance_id HAVING MIN(received_at) >= ?1
             )) AS new_30d`,
        )
        .bind(activeCutoff, weekCutoff),
      db
        .prepare(
          `SELECT ping_day AS day, COUNT(DISTINCT COALESCE(instance_id, 'anon:' || id)) AS instances
           FROM instance_pings WHERE ping_day >= ?1 GROUP BY ping_day ORDER BY day`,
        )
        .bind(historyCutoff),
      db
        .prepare(
          `SELECT app_version AS value, COUNT(*) AS instances,
                  SUM(CASE WHEN app_is_dev = 1 THEN 1 ELSE 0 END) AS dev_instances
           FROM latest_pings WHERE received_at >= ?1 GROUP BY app_version`,
        )
        .bind(activeCutoff),
      db
        .prepare(
          unpivot(
            `'node', p.runtime_node, 'platform', p.runtime_platform, 'arch', p.runtime_arch,
             'sqlite', p.runtime_sqlite, 'timezone', p.runtime_timezone`,
          ),
        )
        .bind(activeCutoff),
      db
        .prepare(
          unpivot(
            `'auth_enabled', p.config_auth_enabled, 'guest_access', p.config_guest_access,
             'registration_open', p.config_registration_open,
             'update_check_enabled', p.config_update_check_enabled,
             'default_locale', p.config_default_locale,
             'rate_limit_overrides', p.config_rate_limit_overrides`,
          ),
        )
        .bind(activeCutoff),
      db
        .prepare(
          unpivot(
            `'users', p.scale_users, 'calendars', p.scale_calendars, 'shifts', p.scale_shifts,
             'presets', p.scale_presets, 'notes', p.scale_notes, 'bundles', p.scale_bundles,
             'shares', p.scale_shares, 'access_tokens', p.scale_access_tokens,
             'signups', p.scale_signups`,
          ),
        )
        .bind(activeCutoff),
      db
        .prepare(
          unpivot(
            `'external_syncs', p.features_external_syncs,
             'calendar_view_overrides', p.features_calendar_view_overrides,
             'custom_fields_count', p.features_custom_fields_count,
             'archived_presets', p.features_archived_presets,
             'split_shifts', p.features_split_shifts`,
          ),
        )
        .bind(activeCutoff),
      db
        .prepare(
          `SELECT t.value AS value, COUNT(DISTINCT p.id) AS instances
           FROM latest_pings AS p, json_each(p.features_custom_field_types) AS t
           WHERE p.received_at >= ?1 GROUP BY t.value`,
        )
        .bind(activeCutoff),
      db
        .prepare(
          `SELECT ROUND(AVG(health_uptime_hours), 1) AS avg_uptime,
                  SUM(CASE WHEN health_sync_failures_24h > 0 THEN 1 ELSE 0 END) AS with_failures
           FROM latest_pings WHERE received_at >= ?1`,
        )
        .bind(activeCutoff),
    ]);

  const totalsRow = (totals.results[0] ?? {}) as Record<string, number>;
  const base = Number(totalsRow.total ?? 0);

  const instances = {
    total: base,
    activeLast7Days: Number(totalsRow.active_7d ?? 0),
    newLast30Days: Number(totalsRow.new_30d ?? 0),
  };

  // Below the floor, any distribution or history point would single out the one instance.
  // The headline counts above are still published — that's a deliberate product decision.
  if (base < MIN_GROUP_SIZE) {
    return {
      computedAt: now.toISOString(),
      instances,
      history: [],
      versions: [],
      environment: {},
      configuration: {},
      sizes: {},
      features: {},
      customFieldTypes: [],
      health: { avgUptimeHours: 0, instancesWithSyncFailures: 0 },
    };
  }

  const healthRow = (health.results[0] ?? {}) as Record<string, number | null>;

  const versionRows = versions.results as unknown as Array<{
    value: string;
    instances: number;
    dev_instances: number;
  }>;

  return {
    computedAt: now.toISOString(),
    instances,
    // A day attributable to fewer than MIN_GROUP_SIZE instances is dropped, not floored.
    history: (history.results as unknown as HistoryPoint[]).filter(
      (point) => point.instances >= MIN_GROUP_SIZE,
    ),
    versions: buildVersions(
      versionRows.map((r) => ({
        value: r.value,
        instances: Number(r.instances),
        dev_instances: Number(r.dev_instances),
      })),
      base,
    ),
    environment: groupByKey(environment.results as unknown as RawGroup[], base),
    configuration: groupByKey(configuration.results as unknown as RawGroup[], base),
    sizes: groupByKey(sizes.results as unknown as RawGroup[], base),
    features: groupByKey(features.results as unknown as RawGroup[], base),
    customFieldTypes: collapse(
      (fieldTypes.results as unknown as RawGroup[]).map((r) => ({ ...r, key: "types" })),
      base,
    ),
    health: {
      avgUptimeHours: Number(healthRow.avg_uptime ?? 0),
      instancesWithSyncFailures: Number(healthRow.with_failures ?? 0),
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
  const row = await db.prepare("SELECT json FROM aggregates WHERE key = 'public'").first<{ json: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.json) as PublicAggregate;
  } catch {
    // A corrupt row is treated exactly like a missing one.
    return null;
  }
}
