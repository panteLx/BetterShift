import type { PayloadV1 } from "../schemas/v1";

const COLUMNS = [
  "received_at",
  "ping_day",
  "sent_at",
  "instance_id",
  "schema_version",
  "app_version",
  "app_is_dev",
  "app_migrations",
  "runtime_node",
  "runtime_arch",
  "runtime_platform",
  "runtime_sqlite",
  "runtime_timezone",
  "config_auth_enabled",
  "config_guest_access",
  "config_registration_open",
  "config_default_locale",
  "config_update_check_enabled",
  "config_rate_limit_overrides",
  "scale_users",
  "scale_calendars",
  "scale_shifts",
  "scale_presets",
  "scale_notes",
  "scale_bundles",
  "scale_shares",
  "scale_access_tokens",
  "scale_signups",
  "features_external_syncs",
  "features_calendar_view_overrides",
  "features_custom_fields_count",
  "features_custom_field_types",
  "features_archived_presets",
  "features_split_shifts",
  "health_uptime_hours",
  "health_sync_runs_24h",
  "health_sync_failures_24h",
] as const;

const INSERT = `INSERT INTO instance_pings (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})`;

const bool = (value: boolean): number => (value ? 1 : 0);

// Enumerates target columns rather than spreading, so an unknown input field cannot pass through.
export async function storeInD1(payload: PayloadV1, db: D1Database): Promise<void> {
  const receivedAt = new Date().toISOString();

  const result = await db
    .prepare(INSERT)
    .bind(
      receivedAt,
      receivedAt.slice(0, 10),
      payload.sentAt,
      payload.instanceId,
      payload.schemaVersion,
      payload.app.version,
      bool(payload.app.isDev),
      payload.app.migrations,
      payload.runtime.node,
      payload.runtime.arch,
      payload.runtime.platform,
      payload.runtime.sqlite,
      payload.runtime.timezone,
      bool(payload.config.authEnabled),
      bool(payload.config.guestAccess),
      bool(payload.config.registrationOpen),
      payload.config.defaultLocale,
      bool(payload.config.updateCheckEnabled),
      payload.config.rateLimitOverrides,
      payload.scale.users,
      payload.scale.calendars,
      payload.scale.shifts,
      payload.scale.presets,
      payload.scale.notes,
      payload.scale.bundles,
      payload.scale.shares,
      payload.scale.accessTokens,
      payload.scale.signups,
      payload.features.externalSyncs,
      payload.features.calendarViewOverrides,
      payload.features.customFields.count,
      JSON.stringify(payload.features.customFields.types),
      bool(payload.features.archivedPresets),
      bool(payload.features.splitShifts),
      payload.health.uptimeHours,
      payload.health.syncRuns24h,
      payload.health.syncFailures24h,
    )
    .run();

  // D1 reports a rejected write in the result rather than by throwing.
  if (!result.success) throw new Error("D1 insert did not report success");
}
