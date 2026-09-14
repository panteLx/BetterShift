import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarShares, calendars } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { getCalendarAccess, hasCapability } from "@/lib/auth/permissions";
import {
  assertBundleWithinCallerCapabilities,
  getBundleForCalendar,
  handleBundleServiceError,
} from "@/lib/auth/permission-bundles-service";
import { eq, and } from "drizzle-orm";
import {
  logAuditEvent,
  type CalendarPermissionChangedMetadata,
} from "@/lib/audit-log";

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
    const access = await getCalendarAccess(user.id, calendarId);
    if (!access?.can("manageShares")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { bundleId } = body;

    // Validate the bundle: must exist and belong to this calendar.
    if (!bundleId || typeof bundleId !== "string") {
      return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
    }
    const newBundle = await getBundleForCalendar(calendarId, bundleId);
    if (!newBundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    // A non-owner manageShares holder may only reassign to a bundle whose
    // capabilities are a subset of their own — closes the self-escalation
    // path a fixed cap used to guard against pre-PR.
    assertBundleWithinCallerCapabilities(access, newBundle.capabilities);

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
          columns: { id: true, name: true },
        },
      },
    });

    if (!existingShare) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Update share permission
    await db
      .update(calendarShares)
      .set({ bundleId: newBundle.id })
      .where(eq(calendarShares.id, shareId));

    // Fetch calendar name for audit log
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    // Log audit event
    await logAuditEvent<CalendarPermissionChangedMetadata>({
      userId: user.id,
      action: "calendar.permission.changed",
      resourceType: "calendar",
      resourceId: calendarId,
      severity: "info",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        user:
          existingShare.user.email ||
          existingShare.user.name ||
          existingShare.userId,
        oldBundleId: existingShare.bundle.id,
        oldBundleName: existingShare.bundle.name,
        newBundleId: newBundle.id,
        newBundleName: newBundle.name,
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
        bundle: {
          columns: { id: true, name: true, seedKey: true },
        },
      },
    });

    return NextResponse.json(shareWithUser);
  } catch (error) {
    return handleBundleServiceError(error, "Failed to update share");
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

    // Check permissions: manageShares holder can remove any share (S1/S2 —
    // that includes admin-capable ones, no owner-only carve-out), users can
    // remove their own.
    const hasAdminPermission = await hasCapability(
      user.id,
      calendarId,
      "manageShares"
    );
    const isSelf = share.userId === user.id;

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
