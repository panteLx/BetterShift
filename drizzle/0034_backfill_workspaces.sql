-- Backfill a single `default` workspace for every pre-existing self-hosted
-- install, so MULTI_TENANT=false keeps working with zero manual steps.
-- Mirrors the drizzle/0019-0021 additive/backfill/rebuild precedent.

INSERT INTO organization (id, slug, name, created_at)
VALUES ('default', 'default', 'BetterShift', cast(unixepoch('subsecond') * 1000 as integer));
--> statement-breakpoint

-- The earliest superadmin becomes owner; if none exists yet (a DB with no
-- users at all), the earliest user does. Matches handleFirstUserPromotion's
-- notion of "first user" for consistency with new signups (see lib/auth.ts).
INSERT INTO member (id, organization_id, user_id, role, created_at)
SELECT
  lower(hex(randomblob(16))),
  'default',
  id,
  CASE
    WHEN id = (SELECT id FROM user WHERE role = 'superadmin' ORDER BY created_at ASC LIMIT 1)
      THEN 'owner'
    WHEN (SELECT COUNT(*) FROM user WHERE role = 'superadmin') = 0
      AND id = (SELECT id FROM user ORDER BY created_at ASC LIMIT 1)
      THEN 'owner'
    ELSE 'member'
  END,
  cast(unixepoch('subsecond') * 1000 as integer)
FROM user;
--> statement-breakpoint

UPDATE calendars SET workspace_id = 'default' WHERE workspace_id IS NULL;
--> statement-breakpoint
UPDATE announcements SET workspace_id = 'default' WHERE workspace_id IS NULL;
--> statement-breakpoint
UPDATE audit_logs SET workspace_id = 'default' WHERE workspace_id IS NULL;
--> statement-breakpoint

-- organization/member created_at are timestamp_ms integers (better-auth
-- reads them as Date); workspace_settings.updated_at is seconds like system_settings.
-- Exactly one workspace_settings row for 'default', whether or not a
-- system_settings row already exists (a brand-new DB has none yet).
INSERT INTO workspace_settings (workspace_id, allow_guest_access, updated_at)
SELECT 'default', s.allow_guest_access, unixepoch()
FROM system_settings s WHERE s.id = 'default'
UNION ALL
SELECT 'default', NULL, unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE id = 'default');
