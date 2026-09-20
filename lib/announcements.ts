import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import {
  ANNOUNCEMENT_TONES,
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  getAnnouncementStatus,
  isVisibleNow,
  type AnnouncementStatus,
  type AnnouncementTone,
} from "@/lib/announcement-status";

// Re-exported so existing server-side consumers keep importing from this
// module; client components should import these from lib/announcement-status
// directly to avoid pulling lib/db into the browser bundle.
export { ANNOUNCEMENT_TONES, BODY_MAX_LENGTH, TITLE_MAX_LENGTH, getAnnouncementStatus, isVisibleNow };
export type { AnnouncementStatus, AnnouncementTone };

export const ANNOUNCEMENT_PLACEMENTS = ["auth", "dashboard"] as const;
export type AnnouncementPlacement = (typeof ANNOUNCEMENT_PLACEMENTS)[number];

/** Exactly what the public route returns -- no creator, no timestamps. */
export interface PublicAnnouncement {
  id: string;
  title: string;
  body: string | null;
  tone: AnnouncementTone;
}

export interface AnnouncementInput {
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  showOnAuth: boolean;
  showOnDashboard: boolean;
  enabled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export type AnnouncementInputError =
  | "INVALID_BODY_PAYLOAD"
  | "TITLE_REQUIRED"
  | "TITLE_TOO_LONG"
  | "BODY_TOO_LONG"
  | "INVALID_TONE"
  | "NO_PLACEMENT"
  | "INVALID_STARTS_AT"
  | "INVALID_ENDS_AT"
  | "INVALID_WINDOW";

/** undefined means "present but unparseable", which the caller rejects. */
function parseTimestamp(value: unknown): Date | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function sanitizeAnnouncementInput(
  raw: unknown
): { ok: true; value: AnnouncementInput } | { ok: false; error: AnnouncementInputError } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "INVALID_BODY_PAYLOAD" };
  }
  const input = raw as Record<string, unknown>;

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "TITLE_REQUIRED" };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, error: "TITLE_TOO_LONG" };

  const trimmedBody = typeof input.body === "string" ? input.body.trim() : "";
  if (trimmedBody.length > BODY_MAX_LENGTH) return { ok: false, error: "BODY_TOO_LONG" };
  const body = trimmedBody === "" ? null : trimmedBody;

  if (!ANNOUNCEMENT_TONES.includes(input.tone as AnnouncementTone)) {
    return { ok: false, error: "INVALID_TONE" };
  }
  const tone = input.tone as AnnouncementTone;

  const showOnAuth = input.showOnAuth === true;
  const showOnDashboard = input.showOnDashboard === true;
  // An announcement with neither placement can never be seen; that is a mistake,
  // not a configuration.
  if (!showOnAuth && !showOnDashboard) return { ok: false, error: "NO_PLACEMENT" };

  const enabled = input.enabled !== false;

  const startsAt = parseTimestamp(input.startsAt);
  if (startsAt === undefined) return { ok: false, error: "INVALID_STARTS_AT" };
  const endsAt = parseTimestamp(input.endsAt);
  if (endsAt === undefined) return { ok: false, error: "INVALID_ENDS_AT" };
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "INVALID_WINDOW" };
  }

  return {
    ok: true,
    value: { title, body, tone, showOnAuth, showOnDashboard, enabled, startsAt, endsAt },
  };
}

export async function getVisibleAnnouncements(
  placement: AnnouncementPlacement
): Promise<PublicAnnouncement[]> {
  const now = new Date();
  const placementColumn =
    placement === "auth" ? announcements.showOnAuth : announcements.showOnDashboard;

  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      tone: announcements.tone,
    })
    .from(announcements)
    .where(
      and(
        eq(announcements.enabled, true),
        eq(placementColumn, true),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
        or(isNull(announcements.endsAt), gt(announcements.endsAt, now))
      )
    )
    .orderBy(desc(announcements.createdAt));
}
