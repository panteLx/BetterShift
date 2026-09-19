import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calendarAccessTokens,
  calendarCustomFields,
  calendarNotes,
  calendarPermissionBundles,
  calendarShares,
  calendars,
  externalSyncs,
  shiftPresets,
  shiftSignups,
  shifts,
  syncLogs,
  user,
} from "@/lib/db/schema";
import { getSystemSettings } from "@/lib/system-settings";
import { getBuildInfo } from "@/lib/version";
import {
  isAuthEnabled,
  allowGuestAccess,
  allowUserRegistration,
} from "@/lib/auth/feature-flags";
import { DEFAULT_TELEMETRY_ENDPOINT } from "@/lib/telemetry/config";
import {
  TELEMETRY_SCHEMA_VERSION,
  toBucket,
  type DiagnosticsPayload,
  type TelemetryPayload,
  type TelemetryProfile,
} from "@/lib/telemetry/schema";

const startedAt = Date.now();

// Counting spans a dozen tables; cache like getSystemSettings() so the admin
// preview and the daily send don't repeat all of it on every call.
let cached: {
  profile: TelemetryProfile;
  value: TelemetryPayload | DiagnosticsPayload;
  expiresAt: number;
} | null = null;
const CACHE_DURATION = 10 * 1000;

export function clearTelemetryCache(): void {
  cached = null;
}

// Only these keys ever leave the instance; never iterate process.env itself.
const REPORTABLE_ENV = [
  "AUTH_ENABLED",
  "ALLOW_GUEST_ACCESS",
  "ALLOW_USER_REGISTRATION",
  "DEFAULT_LOCALE",
  "TZ",
  "TELEMETRY_ENABLED",
  "TELEMETRY_ENDPOINT",
] as const;

function collectEnvFlags(): Record<string, string> {
  const flags: Record<string, string> = {};
  for (const key of REPORTABLE_ENV) {
    const value = process.env[key];
    if (value !== undefined) flags[key] = value;
  }
  // A self-hosted receiver URL can be private and carry a token, and this export
  // is pasted into public issues -- report only whether it differs from the default.
  const endpoint = process.env.TELEMETRY_ENDPOINT;
  flags.TELEMETRY_ENDPOINT =
    endpoint && endpoint !== DEFAULT_TELEMETRY_ENDPOINT ? "custom" : "default";
  return flags;
}

function collectMigrationList(): string[] {
  const rows = db.all<{ hash: string }>(
    sql`select hash from __drizzle_migrations order by created_at`
  );
  return rows.map((row) => row.hash);
}

function countMigrations(): number {
  const [row] = db.all<{ value: number }>(
    sql`select count(*) as value from __drizzle_migrations`
  );
  return row?.value ?? 0;
}

export async function collectTelemetryPayload(
  profile: "telemetry"
): Promise<TelemetryPayload>;
export async function collectTelemetryPayload(
  profile: "diagnostics"
): Promise<DiagnosticsPayload>;
export async function collectTelemetryPayload(
  profile: TelemetryProfile
): Promise<TelemetryPayload | DiagnosticsPayload> {
  if (cached && cached.profile === profile && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const [settings, buildInfo] = await Promise.all([
    getSystemSettings(),
    getBuildInfo(),
  ]);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    users,
    calendarCount,
    shiftCount,
    presetCount,
    noteCount,
    bundleCount,
    shareCount,
    tokenCount,
    signupCount,
    syncCount,
    customFieldCount,
    viewOverrideCount,
    archivedPresetCount,
    splitShiftCalendarCount,
    syncRuns24h,
    syncFailures24h,
    migrations,
  ] = await Promise.all([
    db.$count(user),
    db.$count(calendars),
    db.$count(shifts),
    db.$count(shiftPresets),
    db.$count(calendarNotes),
    db.$count(calendarPermissionBundles),
    db.$count(calendarShares),
    db.$count(calendarAccessTokens),
    db.$count(shiftSignups),
    db.$count(externalSyncs),
    db.$count(calendarCustomFields),
    db.$count(calendars, sql`${calendars.viewSettings} is not null`),
    db.$count(shiftPresets, sql`${shiftPresets.archivedAt} is not null`),
    db.$count(calendars, eq(calendars.splitShiftsEnabled, true)),
    db.$count(syncLogs, gte(syncLogs.syncedAt, since)),
    db.$count(
      syncLogs,
      and(gte(syncLogs.syncedAt, since), ne(syncLogs.status, "success"))
    ),
    countMigrations(),
  ]);

  const fieldTypeRows = await db
    .selectDistinct({ type: calendarCustomFields.type })
    .from(calendarCustomFields);
  const types = fieldTypeRows.map((row) => row.type).sort();

  const sqliteVersion =
    db.all<{ v: string }>(sql`select sqlite_version() as v`)[0]?.v ??
    "unknown";

  const rateLimitOverrides = Object.keys(process.env).filter((key) =>
    key.startsWith("RATE_LIMIT_")
  ).length;

  const base = {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    instanceId: settings.telemetryInstanceId,
    sentAt: new Date().toISOString(),
    app: {
      version: buildInfo.version,
      isDev: buildInfo.version.includes("dev"),
      migrations,
    },
    runtime: {
      node: process.versions.node,
      arch: process.arch,
      platform: process.platform,
      sqlite: sqliteVersion,
      timezone: process.env.TZ ?? "unknown",
    },
    config: {
      authEnabled: isAuthEnabled(),
      guestAccess: await allowGuestAccess(),
      registrationOpen: allowUserRegistration(),
      defaultLocale: process.env.DEFAULT_LOCALE ?? "en",
      updateCheckEnabled: settings.updateCheckEnabled,
      rateLimitOverrides,
    },
    health: {
      uptimeHours: Math.round((Date.now() - startedAt) / 3_600_000),
      syncRuns24h,
      syncFailures24h,
    },
  };

  const archivedPresets = archivedPresetCount > 0;
  const splitShifts = splitShiftCalendarCount > 0;

  const value: TelemetryPayload | DiagnosticsPayload =
    profile === "telemetry"
      ? {
          ...base,
          scale: {
            users: toBucket(users),
            calendars: toBucket(calendarCount),
            shifts: toBucket(shiftCount),
            presets: toBucket(presetCount),
            notes: toBucket(noteCount),
            bundles: toBucket(bundleCount),
            shares: toBucket(shareCount),
            accessTokens: toBucket(tokenCount),
            signups: toBucket(signupCount),
          },
          features: {
            externalSyncs: toBucket(syncCount),
            calendarViewOverrides: toBucket(viewOverrideCount),
            customFields: { count: toBucket(customFieldCount), types },
            archivedPresets,
            splitShifts,
          },
        }
      : {
          ...base,
          scale: {
            users,
            calendars: calendarCount,
            shifts: shiftCount,
            presets: presetCount,
            notes: noteCount,
            bundles: bundleCount,
            shares: shareCount,
            accessTokens: tokenCount,
            signups: signupCount,
          },
          features: {
            externalSyncs: syncCount,
            calendarViewOverrides: viewOverrideCount,
            customFields: { count: customFieldCount, types },
            archivedPresets,
            splitShifts,
          },
          envFlags: collectEnvFlags(),
          migrationList: collectMigrationList(),
        };

  cached = { profile, value, expiresAt: Date.now() + CACHE_DURATION };
  return value;
}
