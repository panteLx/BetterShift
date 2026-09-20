-- One row per received ping, never updated. Mirrors PayloadV1 in src/schemas/v1.ts
-- column by column, so a payload change needs a new migration here too.
CREATE TABLE IF NOT EXISTS instance_pings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- The Worker's own clock. sent_at is the instance's and can be skewed or wrong.
  received_at TEXT NOT NULL,
  ping_day TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  instance_id TEXT,
  schema_version INTEGER NOT NULL,

  app_version TEXT NOT NULL,
  app_is_dev INTEGER NOT NULL,
  app_migrations INTEGER NOT NULL,

  runtime_node TEXT NOT NULL,
  runtime_arch TEXT NOT NULL,
  runtime_platform TEXT NOT NULL,
  runtime_sqlite TEXT NOT NULL,
  runtime_timezone TEXT NOT NULL,

  config_auth_enabled INTEGER NOT NULL,
  config_guest_access INTEGER NOT NULL,
  config_registration_open INTEGER NOT NULL,
  config_default_locale TEXT NOT NULL,
  config_update_check_enabled INTEGER NOT NULL,
  config_rate_limit_overrides INTEGER NOT NULL,

  scale_users TEXT NOT NULL,
  scale_calendars TEXT NOT NULL,
  scale_shifts TEXT NOT NULL,
  scale_presets TEXT NOT NULL,
  scale_notes TEXT NOT NULL,
  scale_bundles TEXT NOT NULL,
  scale_shares TEXT NOT NULL,
  scale_access_tokens TEXT NOT NULL,
  scale_signups TEXT NOT NULL,

  features_external_syncs TEXT NOT NULL,
  features_calendar_view_overrides TEXT NOT NULL,
  features_custom_fields_count TEXT NOT NULL,
  -- JSON array; query it with json_each(), see queries/custom-field-types.sql.
  features_custom_field_types TEXT NOT NULL,
  features_archived_presets INTEGER NOT NULL,
  features_split_shifts INTEGER NOT NULL,

  health_uptime_hours REAL NOT NULL,
  health_sync_runs_24h INTEGER NOT NULL,
  health_sync_failures_24h INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instance_pings_ping_day ON instance_pings (ping_day);
CREATE INDEX IF NOT EXISTS idx_instance_pings_instance ON instance_pings (instance_id, received_at);
CREATE INDEX IF NOT EXISTS idx_instance_pings_version ON instance_pings (app_version);

-- The newest ping per instance -- what every distribution query reads, so a chatty
-- instance cannot outvote a quiet one. A ping without an instance_id cannot be
-- attributed to one, so each such ping counts as its own instance.
CREATE VIEW IF NOT EXISTS latest_pings AS
SELECT *
FROM instance_pings
WHERE id IN (
  SELECT MAX(id) FROM instance_pings GROUP BY COALESCE(instance_id, 'anon:' || id)
);
