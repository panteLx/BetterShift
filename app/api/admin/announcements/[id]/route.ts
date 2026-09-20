import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { sanitizeAnnouncementInput } from "@/lib/announcements";
import { rateLimit } from "@/lib/rate-limiter";
import {
  logAdminAction,
  type AdminAnnouncementDeletedMetadata,
  type AdminAnnouncementUpdatedMetadata,
} from "@/lib/audit-log";
import { requireAnnouncementAccess } from "../route";

/**
 * Admin Announcement Item API
 *
 * PATCH  /api/admin/announcements/[id]
 * DELETE /api/admin/announcements/[id]
 *
 * Permission: Admin or Superadmin (canManageSystemSettings)
 */
function forAudit(row: typeof announcements.$inferSelect) {
  return {
    title: row.title,
    tone: row.tone,
    showOnAuth: row.showOnAuth,
    showOnDashboard: row.showOnDashboard,
    enabled: row.enabled,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAnnouncementAccess(request);
  if (access.error) return access.error;
  const currentUser = access.currentUser;

  const rateLimitResponse = rateLimit(request, currentUser.id, "admin-announcement-mutations");
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;

  try {
    const [existing] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    // The sheet always submits the whole announcement, so the same sanitiser
    // covers create and update -- no partial-patch branch to keep in sync.
    const parsed = sanitizeAnnouncementInput(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const [updated] = await db
      .update(announcements)
      .set(parsed.value)
      .where(eq(announcements.id, id))
      .returning();

    await logAdminAction<AdminAnnouncementUpdatedMetadata>({
      action: "admin.announcement.update",
      userId: currentUser.id,
      resourceType: "announcement",
      resourceId: id,
      metadata: { before: forAudit(existing), after: forAudit(updated) },
      request,
    });

    return NextResponse.json({ announcement: updated });
  } catch (err) {
    console.error("Failed to update announcement:", err);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAnnouncementAccess(request);
  if (access.error) return access.error;
  const currentUser = access.currentUser;

  const rateLimitResponse = rateLimit(request, currentUser.id, "admin-announcement-mutations");
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;

  try {
    const [existing] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.delete(announcements).where(eq(announcements.id, id));

    await logAdminAction<AdminAnnouncementDeletedMetadata>({
      action: "admin.announcement.delete",
      userId: currentUser.id,
      resourceType: "announcement",
      resourceId: id,
      metadata: { title: existing.title },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete announcement:", err);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
