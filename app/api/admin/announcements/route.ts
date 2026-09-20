import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
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
        createdAt: announcements.createdAt,
        createdByName: userTable.name,
      })
      .from(announcements)
      .leftJoin(userTable, eq(announcements.createdBy, userTable.id))
      .orderBy(desc(announcements.createdAt));

    return NextResponse.json({ announcements: rows });
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
