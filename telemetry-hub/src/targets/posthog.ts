import type { PayloadV1 } from "../schemas/v1";

const POSTHOG_ENDPOINT = "https://us.i.posthog.com/i/v0/e/";

// Enumerates target fields rather than spreading, so an unknown input field cannot pass through.
export async function sendToPostHog(payload: PayloadV1, apiKey: string): Promise<void> {
  const body = {
    api_key: apiKey,
    event: "instance_ping",
    distinct_id: payload.instanceId ?? "anonymous",
    timestamp: payload.sentAt,
    properties: {
      // The Worker runs in the PoP nearest the sending instance, so PostHog would
      // geolocate that IP and approximate every instance's location.
      $ip: null,
      $geoip_disable: true,
      // Keeps PostHog from creating a person profile per instance -- there is no person here.
      $process_person_profile: false,
      schema_version: payload.schemaVersion,
      app_version: payload.app.version,
      app_is_dev: payload.app.isDev,
      app_migrations: payload.app.migrations,
      runtime_node: payload.runtime.node,
      runtime_arch: payload.runtime.arch,
      runtime_platform: payload.runtime.platform,
      runtime_sqlite: payload.runtime.sqlite,
      runtime_timezone: payload.runtime.timezone,
      config_auth_enabled: payload.config.authEnabled,
      config_guest_access: payload.config.guestAccess,
      config_registration_open: payload.config.registrationOpen,
      config_default_locale: payload.config.defaultLocale,
      config_update_check_enabled: payload.config.updateCheckEnabled,
      config_rate_limit_overrides: payload.config.rateLimitOverrides,
      scale_users: payload.scale.users,
      scale_calendars: payload.scale.calendars,
      scale_shifts: payload.scale.shifts,
      scale_presets: payload.scale.presets,
      scale_notes: payload.scale.notes,
      scale_bundles: payload.scale.bundles,
      scale_shares: payload.scale.shares,
      scale_access_tokens: payload.scale.accessTokens,
      scale_signups: payload.scale.signups,
      features_external_syncs: payload.features.externalSyncs,
      features_calendar_view_overrides: payload.features.calendarViewOverrides,
      features_custom_fields_count: payload.features.customFields.count,
      features_custom_field_types: payload.features.customFields.types,
      features_archived_presets: payload.features.archivedPresets,
      features_split_shifts: payload.features.splitShifts,
      health_uptime_hours: payload.health.uptimeHours,
      health_sync_runs_24h: payload.health.syncRuns24h,
      health_sync_failures_24h: payload.health.syncFailures24h,
    },
  };

  const response = await fetch(POSTHOG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // fetch resolves on 4xx/5xx, so a rejected key or wrong region would otherwise vanish.
  if (!response.ok) throw new Error(`PostHog responded with ${response.status}`);
}
