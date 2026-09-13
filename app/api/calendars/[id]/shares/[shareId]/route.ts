import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarShares, calendars } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability, isCalendarOwner } from "@/lib/auth/permissions";
import {
  coarseLevelFromCapabilities,
  findSeededBundleId,
} from "@/lib/auth/legacy-permission-compat";
import { sanitizeCapabilities } from "@/lib/permission-bundles";
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
    const hasPermission = await hasCapability(
      user.id,
      calendarId,
      "manageShares"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { permission } = body;

    // Validate permission value. "owner" is intentionally excluded — ownership
    // transfer is not a share concept and only happens through admin routes.
    const validPermissions = ["admin", "write", "read"];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission value" },
        { status: 400 }
      );
    }

    // Only owner can set/change admin permissions
    if (permission === "admin") {
      const isOwner = await isCalendarOwner(user.id, calendarId);
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
        bundle: {
          columns: {
            capabilities: true,
          },
        },
      },
    });

    if (!existingShare) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const existingLevel = coarseLevelFromCapabilities(
      sanitizeCapabilities(existingShare.bundle.capabilities)
    );

    // Only owner can modify admin permissions.
    if (existingLevel === "admin") {
      const isOwner = await isCalendarOwner(user.id, calendarId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the owner can modify admin permissions" },
          { status: 403 }
        );
      }
    }

    // Resolve the legacy enum value to this calendar's matching seeded bundle
    const bundleId = await findSeededBundleId(calendarId, permission);
    if (!bundleId) {
      return NextResponse.json(
        { error: "Calendar is missing its seeded permission bundles" },
        { status: 500 }
      );
    }

    // Update share permission
    await db
      .update(calendarShares)
      .set({ bundleId })
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
        oldPermission: existingLevel,
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

    return NextResponse.json({ ...shareWithUser, permission });
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
        bundle: {
          columns: {
            capabilities: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Check permissions: owner can remove any share, admin can remove non-admin shares, users can remove their own
    const hasAdminPermission = await hasCapability(
      user.id,
      calendarId,
      "manageShares"
    );
    const isOwner = await isCalendarOwner(user.id, calendarId);
    const isSelf = share.userId === user.id;

    const shareLevel = coarseLevelFromCapabilities(
      sanitizeCapabilities(share.bundle.capabilities)
    );

    // Only owner can remove admin shares
    if (shareLevel === "admin" && !isOwner) {
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
