import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars as calendarsTable,
  user as userTable,
  shifts as shiftsTable,
  calendarNotes as notesTable,
  shiftPresets as presetsTable,
  calendarShares as calendarSharesTable,
  externalSyncs as externalSyncsTable,
  syncLogs as syncLogsTable,
  userCalendarSubscriptions as subscriptionsTable,
  calendarAccessTokens as tokensTable,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  requireAdmin,
  requireSuperAdmin,
  canEditCalendar,
  canDeleteCalendar,
} from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import { eventEmitter } from "@/lib/event-emitter";

/**
 * Admin Calendar Detail API
 *
 * GET /api/admin/calendars/[id]
 * Returns detailed information about a specific calendar.
 *
 * PATCH /api/admin/calendars/[id]
 * Updates calendar information (name, color, guestPermission).
 * - Admin & Superadmin: Can update calendars
 * - Cannot change ownerId via PATCH (use transfer endpoint)
 *
 * DELETE /api/admin/calendars/[id]
 * Deletes calendar and all associated data.
 * - Superadmin only
 *
 * Permission: Admin or Superadmin (role-based restrictions apply)
 */

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: calendarId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Get calendar with owner info
    const [calendar] = await db
      .select({
        id: calendarsTable.id,
        name: calendarsTable.name,
        color: calendarsTable.color,
        ownerId: calendarsTable.ownerId,
        guestPermission: calendarsTable.guestPermission,
        createdAt: calendarsTable.createdAt,
        updatedAt: calendarsTable.updatedAt,
        ownerName: userTable.name,
        ownerEmail: userTable.email,
        ownerImage: userTable.image,
      })
      .from(calendarsTable)
      .leftJoin(userTable, eq(calendarsTable.ownerId, userTable.id))
      .where(eq(calendarsTable.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Get statistics
    const [shiftCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shiftsTable)
      .where(eq(shiftsTable.calendarId, calendarId));

    const [noteCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notesTable)
      .where(eq(notesTable.calendarId, calendarId));

    const [presetCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(presetsTable)
      .where(eq(presetsTable.calendarId, calendarId));

    const [shareCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(calendarSharesTable)
      .where(eq(calendarSharesTable.calendarId, calendarId));

    // Get share list
    const shares = await db
      .select({
        id: calendarSharesTable.id,
        userId: calendarSharesTable.userId,
        permission: calendarSharesTable.permission,
        createdAt: calendarSharesTable.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        userImage: userTable.image,
      })
      .from(calendarSharesTable)
      .leftJoin(userTable, eq(calendarSharesTable.userId, userTable.id))
      .where(eq(calendarSharesTable.calendarId, calendarId));

    // Get external syncs
    const externalSyncs = await db
      .select({
        id: externalSyncsTable.id,
        name: externalSyncsTable.name,
        syncType: externalSyncsTable.syncType,
        calendarUrl: externalSyncsTable.calendarUrl,
        createdAt: externalSyncsTable.createdAt,
      })
      .from(externalSyncsTable)
      .where(eq(externalSyncsTable.calendarId, calendarId));

    return NextResponse.json({
      ...calendar,
      shiftCount: Number(shiftCount?.count || 0),
      noteCount: Number(noteCount?.count || 0),
      presetCount: Number(presetCount?.count || 0),
      shareCount: Number(shareCount?.count || 0),
      shares,
      externalSyncs,
    });
  } catch (error) {
    console.error("[Admin Calendar Detail API] Error:", error);

    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch calendar details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: calendarId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    if (!canEditCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get calendar before update
    const [calendar] = await db
      .select()
      .from(calendarsTable)
      .where(eq(calendarsTable.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: {
      name?: string;
      color?: string;
      guestPermission?: "none" | "read" | "write";
    } = {};

    // Validate and collect allowed updates
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Invalid calendar name" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.color !== undefined) {
      if (typeof body.color !== "string") {
        return NextResponse.json(
          { error: "Invalid color format" },
          { status: 400 }
        );
      }
      updates.color = body.color;
    }

    if (body.guestPermission !== undefined) {
      if (!["none", "read", "write"].includes(body.guestPermission)) {
        return NextResponse.json(
          { error: "Invalid guest permission" },
          { status: 400 }
        );
      }
      updates.guestPermission = body.guestPermission;
    }

    // Don't allow ownerId changes via PATCH (use transfer endpoint)
    if (body.ownerId !== undefined) {
      return NextResponse.json(
        { error: "Use /transfer endpoint to change ownership" },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    // Update calendar
    const [updatedCalendar] = await db
      .update(calendarsTable)
      .set(updates)
      .where(eq(calendarsTable.id, calendarId))
      .returning();

    // Audit log
    const changes = Object.keys(updates);
    await logAuditEvent({
      request,
      action: "admin.calendar.update",
      userId: currentUser.id,
      severity: "warning",
      metadata: {
        calendarId,
        calendarName: updatedCalendar.name,
        changes,
        oldValues: {
          name: calendar.name,
          color: calendar.color,
          guestPermission: calendar.guestPermission,
        },
        newValues: updates,
        updatedBy: currentUser.email,
      },
    });

    // Emit SSE event
    eventEmitter.emit("calendar-change", {
      type: "calendar",
      action: "update",
      calendarId,
      data: updatedCalendar,
    });

    return NextResponse.json(updatedCalendar);
  } catch (error) {
    console.error("[Admin Calendar Update API] Error:", error);

    if (error instanceof Error) {
      if (error.message === "Admin access required") {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to update calendar" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: calendarId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireSuperAdmin(currentUser);

    if (!canDeleteCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get calendar info before deletion
    const [calendar] = await db
      .select()
      .from(calendarsTable)
      .where(eq(calendarsTable.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Get statistics for audit log
    const [shiftCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(shiftsTable)
      .where(eq(shiftsTable.calendarId, calendarId));

    const [noteCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notesTable)
      .where(eq(notesTable.calendarId, calendarId));

    const [presetCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(presetsTable)
      .where(eq(presetsTable.calendarId, calendarId));

    // Delete all related data (cascade)
    await db.delete(shiftsTable).where(eq(shiftsTable.calendarId, calendarId));
    await db.delete(notesTable).where(eq(notesTable.calendarId, calendarId));
    await db
      .delete(presetsTable)
      .where(eq(presetsTable.calendarId, calendarId));
    await db
      .delete(calendarSharesTable)
      .where(eq(calendarSharesTable.calendarId, calendarId));
    await db
      .delete(subscriptionsTable)
      .where(eq(subscriptionsTable.calendarId, calendarId));
    await db.delete(tokensTable).where(eq(tokensTable.calendarId, calendarId));
    await db
      .delete(syncLogsTable)
      .where(eq(syncLogsTable.calendarId, calendarId));
    await db
      .delete(externalSyncsTable)
      .where(eq(externalSyncsTable.calendarId, calendarId));

    // Delete calendar
    await db.delete(calendarsTable).where(eq(calendarsTable.id, calendarId));

    // Audit log
    await logAuditEvent({
      request,
      action: "admin.calendar.delete",
      userId: currentUser.id,
      severity: "critical",
      metadata: {
        calendarId,
        calendarName: calendar.name,
        ownerId: calendar.ownerId,
        shiftCount: Number(shiftCount?.count || 0),
        noteCount: Number(noteCount?.count || 0),
        presetCount: Number(presetCount?.count || 0),
        deletedBy: currentUser.email,
      },
    });

    // Emit SSE event
    eventEmitter.emit("calendar-change", {
      type: "calendar",
      action: "delete",
      calendarId,
      data: { id: calendarId },
    });

    return NextResponse.json({
      message: "Calendar deleted successfully",
      calendarId,
    });
  } catch (error) {
    console.error("[Admin Calendar Delete API] Error:", error);

    if (error instanceof Error) {
      if (error.message === "Superadmin access required") {
        return NextResponse.json(
          { error: "Superadmin access required" },
          { status: 403 }
        );
      }
      if (error.message === "Insufficient permissions") {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete calendar" },
      { status: 500 }
    );
  }
}
