-- Backfill capability bundles for every existing calendar, preserving
-- today's effective owner/admin/write/read behavior 1:1 — see
-- .LOCAL/calendar-permission-bundles-plan.md ("Bundle lifecycle &
-- migration"). The capability lists below are a frozen snapshot of that
-- design at migration time (intentionally duplicated rather than generated
-- from lib/permission-bundles.ts, since a later change to that file must
-- not rewrite what already-applied migrations did).

-- Read: view-only, plus self-signup if this calendar currently allows it.
INSERT INTO calendar_permission_bundles (id, calendar_id, name, capabilities, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'Read',
  CASE WHEN allow_self_signup THEN
    json_array('viewShifts','viewNotesEvents','viewStats','signUpSelf')
  ELSE
    json_array('viewShifts','viewNotesEvents','viewStats')
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendars;
--> statement-breakpoint

-- Contribute: everything today's "write" permission actually grants
-- (presets, shift editing, external sync config and sync-log deletion all
-- included, since that's what write means today).
INSERT INTO calendar_permission_bundles (id, calendar_id, name, capabilities, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'Contribute',
  json_array('viewShifts','viewNotesEvents','viewStats','stampPreset','createShift','deleteShift','editShift','manageNotesEvents','managePresets','manageExternalSync','deleteSyncLogs','viewMembers','signUpSelf','signUpOthers'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendars;
--> statement-breakpoint

-- Manage: nothing in today's ladder maps to it (no such tier exists yet) —
-- seeded with the same content as Contribute so it's immediately usable
-- without affecting any already-assigned share, token or guest link.
INSERT INTO calendar_permission_bundles (id, calendar_id, name, capabilities, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'Manage',
  json_array('viewShifts','viewNotesEvents','viewStats','stampPreset','createShift','deleteShift','editShift','manageNotesEvents','managePresets','manageExternalSync','deleteSyncLogs','viewMembers','signUpSelf','signUpOthers'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendars;
--> statement-breakpoint

-- Admin: everything today's "admin" permission grants (superset of write).
INSERT INTO calendar_permission_bundles (id, calendar_id, name, capabilities, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  'Admin',
  json_array('viewShifts','viewNotesEvents','viewStats','stampPreset','createShift','deleteShift','editShift','manageNotesEvents','managePresets','manageExternalSync','deleteSyncLogs','viewMembers','signUpSelf','signUpOthers','manageShares','manageGuestAccess','manageCalendarSettings'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM calendars;
--> statement-breakpoint

-- Point every existing share at its calendar's matching generated bundle.
-- 'owner' is a legacy value some pre-existing rows may still carry (see the
-- historical cast in app/api/calendars/[id]/shares/[shareId]/route.ts) —
-- it graned full owner-equivalent access under the old hierarchy, so it
-- maps to Admin, the highest tier a share can hold.
UPDATE calendar_shares
SET bundle_id = (
  SELECT b.id FROM calendar_permission_bundles b
  WHERE b.calendar_id = calendar_shares.calendar_id
    AND b.name = CASE calendar_shares.permission
      WHEN 'owner' THEN 'Admin'
      WHEN 'admin' THEN 'Admin'
      WHEN 'write' THEN 'Contribute'
      ELSE 'Read'
    END
);
--> statement-breakpoint

-- Point every existing access token at its calendar's matching generated bundle.
UPDATE calendar_access_tokens
SET bundle_id = (
  SELECT b.id FROM calendar_permission_bundles b
  WHERE b.calendar_id = calendar_access_tokens.calendar_id
    AND b.name = CASE calendar_access_tokens.permission
      WHEN 'write' THEN 'Contribute'
      ELSE 'Read'
    END
);
--> statement-breakpoint

-- Point every calendar with a public guest permission at its matching
-- bundle; calendars with guest_permission = 'none' keep guest_bundle_id NULL.
UPDATE calendars
SET guest_bundle_id = (
  SELECT b.id FROM calendar_permission_bundles b
  WHERE b.calendar_id = calendars.id
    AND b.name = CASE calendars.guest_permission
      WHEN 'write' THEN 'Contribute'
      ELSE 'Read'
    END
)
WHERE calendars.guest_permission != 'none';
