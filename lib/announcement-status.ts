// Pure, DB-free announcement helpers so client components (e.g. the admin
// table) can import them without pulling in lib/db and its better-sqlite3
// dependency into the browser bundle.

export const ANNOUNCEMENT_TONES = ["info", "warning", "danger"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 1000;

export type AnnouncementStatus = "active" | "scheduled" | "expired" | "off";

interface VisibilityFields {
  enabled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export function getAnnouncementStatus(
  row: VisibilityFields,
  now: Date = new Date()
): AnnouncementStatus {
  if (!row.enabled) return "off";
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) return "scheduled";
  if (row.endsAt && row.endsAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

/** The named single-rule form of the visibility check; expressed in JS, mirrored in SQL by getVisibleAnnouncements(). */
export function isVisibleNow(row: VisibilityFields, now: Date = new Date()): boolean {
  return getAnnouncementStatus(row, now) === "active";
}

export const ANNOUNCEMENT_PLACEMENTS = ["auth", "dashboard"] as const;
export type AnnouncementPlacement = (typeof ANNOUNCEMENT_PLACEMENTS)[number];
