import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarShares, calendars } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { checkPermission } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit-log";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const { id: calendarId, shareId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin/owner permission
    const hasPermission = await checkPermission(user.id, calendarId, "admin");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permission } = body;

    // Validate permission value
    const validPermissions = ["owner", "admin", "write", "read"];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission value" },
        { status: 400 }
      );
    }

    // Only owner can set/change admin permissions
    if (permission === "admin") {
      const isOwner = await checkPermission(user.id, calendarId, "owner");
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the owner can grant admin permissions" },
          { status: 403 }
        );
      }
    }

    // Fetch existing share
    const existingShare = await db.query.calendarShares.findFirst({
      where: and(
        eq(calendarShares.id, shareId),
        eq(calendarShares.calendarId, calendarId)
      ),
      with: {
        user: {
          columns: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!existingShare) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Only owner can modify admin permissions
    if (existingShare.permission === "admin") {
      const isOwner = await checkPermission(user.id, calendarId, "owner");
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the owner can modify admin permissions" },
          { status: 403 }
        );
      }
    }

    // Store old permission for audit log
    const oldPermission = existingShare.permission;

    // Update share permission
    await db
      .update(calendarShares)
      .set({ permission })
      .where(eq(calendarShares.id, shareId));

    // Fetch calendar name for audit log
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: "calendar.permission.changed",
      severity: "info",
      request,
      metadata: {
        calendarId,
        calendarName: calendar?.name || "Unknown",
        user:
          existingShare.user.email ||
          existingShare.user.name ||
          existingShare.userId,
        oldPermission,
        newPermission: permission,
      },
    });

    // Fetch updated share with relations
    const shareWithUser = await db.query.calendarShares.findFirst({
      where: eq(calendarShares.id, shareId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sharedByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(shareWithUser);
  } catch (error) {
    console.error("Failed to update calendar share:", error);
    return NextResponse.json(
      { error: "Failed to update share" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const { id: calendarId, shareId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the share first
    const share = await db.query.calendarShares.findFirst({
      where: and(
        eq(calendarShares.id, shareId),
        eq(calendarShares.calendarId, calendarId)
      ),
      with: {
        user: {
          columns: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Check permissions: owner can remove any share, admin can remove non-admin shares, users can remove their own
    const hasAdminPermission = await checkPermission(
      user.id,
      calendarId,
      "admin"
    );
    const isOwner = await checkPermission(user.id, calendarId, "owner");
    const isSelf = share.userId === user.id;

    // Only owner can remove admin shares
    if (share.permission === "admin" && !isOwner) {
      return NextResponse.json(
        { error: "Only the owner can remove admin shares" },
        { status: 403 }
      );
    }

    if (!hasAdminPermission && !isSelf) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch calendar name for audit log
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    // Delete share
    await db.delete(calendarShares).where(eq(calendarShares.id, shareId));

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: "calendar.share.removed",
      severity: "info",
      request,
      metadata: {
        calendarId,
        calendarName: calendar?.name || "Unknown",
        removedUser: share.user.email || share.user.name || share.userId,
        removedBy: isSelf ? "self" : hasAdminPermission ? "admin" : "owner",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete calendar share:", error);
    return NextResponse.json(
      { error: "Failed to delete share" },
      { status: 500 }
    );
  }
}
