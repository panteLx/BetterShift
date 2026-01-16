import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars as calendarsTable,
  shifts as shiftsTable,
  calendarNotes as notesTable,
  shiftPresets as presetsTable,
  calendarShares as calendarSharesTable,
  externalSyncs as externalSyncsTable,
  syncLogs as syncLogsTable,
  userCalendarSubscriptions as subscriptionsTable,
  calendarAccessTokens as tokensTable,
} from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";
import { requireSuperAdmin, canDeleteCalendar } from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin Calendar Bulk Delete API
 *
 * POST /api/admin/calendars/bulk-delete
 * Deletes multiple calendars and all their associated data.
 *
 * Body:
 * - calendarIds: string[] - Array of calendar IDs to delete
 *
 * Permission: Superadmin only
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireSuperAdmin(currentUser);

    // Rate limiting: admin-bulk-operations (strictest limit)
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-bulk-operations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!canDeleteCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const calendarIds: string[] = body.calendarIds;

    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json(
        { error: "calendarIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Get calendar info before deletion
    const calendars = await db
      .select()
      .from(calendarsTable)
      .where(inArray(calendarsTable.id, calendarIds));

    if (calendars.length === 0) {
      return NextResponse.json(
        { error: "No calendars found with provided IDs" },
        { status: 404 }
      );
    }

    // Get total statistics for audit log
    const [totalStats] = await db
      .select({
        shifts: sql<number>`(SELECT COUNT(*) FROM ${shiftsTable} WHERE ${shiftsTable.calendarId} IN ${calendarIds})`,
        notes: sql<number>`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.calendarId} IN ${calendarIds})`,
        presets: sql<number>`(SELECT COUNT(*) FROM ${presetsTable} WHERE ${presetsTable.calendarId} IN ${calendarIds})`,
      })
      .from(calendarsTable)
      .limit(1);

    // Delete all related data for all calendars
    await db
      .delete(shiftsTable)
      .where(inArray(shiftsTable.calendarId, calendarIds));
    await db
      .delete(notesTable)
      .where(inArray(notesTable.calendarId, calendarIds));
    await db
      .delete(presetsTable)
      .where(inArray(presetsTable.calendarId, calendarIds));
    await db
      .delete(calendarSharesTable)
      .where(inArray(calendarSharesTable.calendarId, calendarIds));
    await db
      .delete(subscriptionsTable)
      .where(inArray(subscriptionsTable.calendarId, calendarIds));
    await db
      .delete(tokensTable)
      .where(inArray(tokensTable.calendarId, calendarIds));
    await db
      .delete(syncLogsTable)
      .where(inArray(syncLogsTable.calendarId, calendarIds));
    await db
      .delete(externalSyncsTable)
      .where(inArray(externalSyncsTable.calendarId, calendarIds));

    // Delete all calendars
    await db
      .delete(calendarsTable)
      .where(inArray(calendarsTable.id, calendarIds));

    // Audit log
    await logAuditEvent({
      request,
      action: "admin.calendar.bulk_delete",
      userId: currentUser.id,
      severity: "critical",
      metadata: {
        count: calendars.length,
        calendarIds,
        calendarNames: calendars.map((c) => c.name),
        totalShifts: Number(totalStats?.shifts || 0),
        totalNotes: Number(totalStats?.notes || 0),
        totalPresets: Number(totalStats?.presets || 0),
        deletedBy: currentUser.email,
      },
    });

    return NextResponse.json({
      message: `${calendars.length} calendar(s) deleted successfully`,
      deletedCount: calendars.length,
      calendarIds,
    });
  } catch (error) {
    console.error("[Admin Calendar Bulk Delete API] Error:", error);

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
      { error: "Failed to delete calendars" },
      { status: 500 }
    );
  }
}
