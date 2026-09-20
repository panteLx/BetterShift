import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements, user as userTable } from "@/lib/db/schema";
import {
  getValidatedAdminUser,
  isErrorResponse,
  type AdminUser,
} from "@/lib/auth/admin-helpers";
import { canManageSystemSettings } from "@/lib/auth/admin";
import { sanitizeAnnouncementInput } from "@/lib/announcements";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type AdminAnnouncementCreatedMetadata } from "@/lib/audit-log";

/**
 * Admin Announcements API
 *
 * GET  /api/admin/announcements  -- every row, including disabled and expired
 * POST /api/admin/announcements
 *
 * Permission: Admin or Superadmin (canManageSystemSettings)
 */
/** Timestamps defaulted by SQLite are "YYYY-MM-DD HH:MM:SS" text in UTC; app-written ones are unix seconds. */
function toDate(value: unknown): Date {
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return new Date(Number(value) * 1000);
    const utc = new Date(`${value.replace(" ", "T")}Z`);
    return isNaN(utc.getTime()) ? new Date(value) : utc;
  }
  return new Date();
}

// Same column can hold either shape (see toDate above); normalise to seconds
// here too so ORDER BY reflects actual time rather than SQLite's storage-class
// ordering (INTEGER before TEXT), which would otherwise separate the two.
const createdAtEpoch = sql`case when typeof(${announcements.createdAt}) = 'text' then cast(strftime('%s', ${announcements.createdAt}) as integer) else ${announcements.createdAt} end`;

export type AnnouncementAccess =
  | { error: NextResponse; currentUser?: undefined }
  | { error?: undefined; currentUser: AdminUser };

export async function requireAnnouncementAccess(
  request: NextRequest
): Promise<AnnouncementAccess> {
  const currentUser = await getValidatedAdminUser(request);
  if (isErrorResponse(currentUser)) {
    return { error: currentUser };
  }
  if (!canManageSystemSettings(currentUser)) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { currentUser };
}

export async function GET(request: NextRequest) {
  const access = await requireAnnouncementAccess(request);
  if (access.error) return access.error;

  try {
    const rows = await db
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        tone: announcements.tone,
        showOnAuth: announcements.showOnAuth,
        showOnDashboard: announcements.showOnDashboard,
        enabled: announcements.enabled,
        startsAt: announcements.startsAt,
        endsAt: announcements.endsAt,
        createdAt: sql<unknown>`${announcements.createdAt}`,
        createdByName: userTable.name,
      })
      .from(announcements)
      .leftJoin(userTable, eq(announcements.createdBy, userTable.id))
      .orderBy(desc(createdAtEpoch));

    const items = rows.map((row) => ({ ...row, createdAt: toDate(row.createdAt) }));

    return NextResponse.json({ announcements: items });
  } catch (err) {
    console.error("Failed to list announcements:", err);
    return NextResponse.json({ error: "Failed to list announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAnnouncementAccess(request);
  if (access.error) return access.error;
  const currentUser = access.currentUser;

  const rateLimitResponse = rateLimit(request, currentUser.id, "admin-announcement-mutations");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const parsed = sanitizeAnnouncementInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const [created] = await db
      .insert(announcements)
      .values({ ...parsed.value, createdBy: currentUser.id })
      .returning();

    await logAdminAction<AdminAnnouncementCreatedMetadata>({
      action: "admin.announcement.create",
      userId: currentUser.id,
      resourceType: "announcement",
      resourceId: created.id,
      metadata: {
        announcement: {
          title: created.title,
          tone: created.tone,
          showOnAuth: created.showOnAuth,
          showOnDashboard: created.showOnDashboard,
          enabled: created.enabled,
          startsAt: created.startsAt,
          endsAt: created.endsAt,
        },
      },
      request,
    });

    return NextResponse.json({ announcement: created }, { status: 201 });
  } catch (err) {
    console.error("Failed to create announcement:", err);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
