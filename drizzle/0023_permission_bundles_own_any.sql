-- Own/Any capability split (E1) plus the extended guest lockout (E2, E7)
-- for every bundle that already exists — a frozen, one-time snapshot of
-- this shape, hand-written rather than generated from
-- lib/permission-bundles.ts so a later catalog change never rewrites what
-- this migration already did. See
-- .LOCAL/calendar-permission-bundles-plan.md, Stufe 1b package 2.
--
-- At this point every bundle in the database is one of the four seeded
-- ones from drizzle/0020_backfill_permission_bundles.sql (the bundle
-- editor that lets an owner create custom bundles doesn't exist yet), so
-- name-based matching below is safe.

-- 1. Rename the collapsed capabilities into their Own/Any pair. Every
--    Contribute/Manage/Admin bundle currently holds the old name (0020
--    gave all three the full "write" content), so this is unconditional.
--    Plain substring replacement is safe: capabilities is compact
--    JSON (`["a","b"]`, no whitespace) and none of the old names is a
--    substring of another capability name.
UPDATE calendar_permission_bundles
SET capabilities = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(capabilities, '"editShift"', '"editOwnShift","editAnyShift"'),
      '"deleteShift"', '"deleteOwnShift","deleteAnyShift"'
    ),
    '"managePresets"', '"manageOwnPresets","manageAnyPresets"'
  ),
  '"manageNotesEvents"', '"manageOwnNotesEvents","manageAnyNotesEvents"'
);
--> statement-breakpoint

-- 2. Stamp seedKey so the UI can show a translated standard name until the
--    bundle is renamed (E6).
UPDATE calendar_permission_bundles SET seed_key = 'read' WHERE name = 'Read' AND seed_key IS NULL;
--> statement-breakpoint
UPDATE calendar_permission_bundles SET seed_key = 'contribute' WHERE name = 'Contribute' AND seed_key IS NULL;
--> statement-breakpoint
UPDATE calendar_permission_bundles SET seed_key = 'manage' WHERE name = 'Manage' AND seed_key IS NULL;
--> statement-breakpoint
UPDATE calendar_permission_bundles SET seed_key = 'admin' WHERE name = 'Admin' AND seed_key IS NULL;
--> statement-breakpoint

-- 3. Extend the guest lockout to manageExternalSync/deleteSyncLogs (E2),
--    without changing anything for an already-invited user. Contribute and
--    Manage currently hold identical content (0020), so repointing every
--    share that sits on a synced Contribute bundle to that calendar's
--    Manage bundle preserves that user's behavior exactly (Manage keeps
--    the sync capabilities). Only guest/link access — calendars.guest_bundle_id
--    and calendar_access_tokens, deliberately untouched here — actually
--    loses the capability, which is the intended behavior change.
UPDATE calendar_shares
SET bundle_id = (
  SELECT manage.id FROM calendar_permission_bundles manage
  WHERE manage.calendar_id = (
    SELECT contribute.calendar_id FROM calendar_permission_bundles contribute
    WHERE contribute.id = calendar_shares.bundle_id
  )
  AND manage.name = 'Manage'
)
WHERE bundle_id IN (
  SELECT id FROM calendar_permission_bundles
  WHERE name = 'Contribute' AND capabilities LIKE '%"manageExternalSync"%'
);
--> statement-breakpoint

-- 4. Now strip manageExternalSync/deleteSyncLogs from every Contribute
--    bundle — no share still points at one with that capability set after
--    step 3, so this only affects guest/link reachability.
UPDATE calendar_permission_bundles
SET capabilities = (
  SELECT json_group_array(value)
  FROM json_each(calendar_permission_bundles.capabilities)
  WHERE value NOT IN ('manageExternalSync', 'deleteSyncLogs')
)
WHERE name = 'Contribute';
