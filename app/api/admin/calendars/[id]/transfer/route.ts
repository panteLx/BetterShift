import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars as calendarsTable,
  user as userTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, canTransferCalendar } from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin Calendar Transfer API
 *
 * POST /api/admin/calendars/[id]/transfer
 * Transfers calendar ownership to a different user.
 *
 * Body:
 * - newOwnerId: string - User ID to transfer to
 * OR
 * - assignToSelf: boolean - Transfer to current admin (for orphaned calendars)
 *
 * Permission: Admin or Superadmin
 */

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: calendarId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Rate limiting: admin-calendar-mutations
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-calendar-mutations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!canTransferCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    let newOwnerId: string;

    // Determine new owner ID
    if (body.assignToSelf === true) {
      newOwnerId = currentUser.id;
    } else if (body.newOwnerId) {
      newOwnerId = body.newOwnerId;
    } else {
      return NextResponse.json(
        { error: "Either newOwnerId or assignToSelf must be provided" },
        { status: 400 }
      );
    }

    // Validate new owner exists
    const [newOwner] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, newOwnerId))
      .limit(1);

    if (!newOwner) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    // Get calendar info before transfer
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

    const previousOwnerId = calendar.ownerId;

    // Transfer ownership
    const [updatedCalendar] = await db
      .update(calendarsTable)
      .set({ ownerId: newOwnerId })
      .where(eq(calendarsTable.id, calendarId))
      .returning();

    // Audit log
    await logAuditEvent({
      request,
      action: "admin.calendar.transfer",
      userId: currentUser.id,
      severity: "warning",
      metadata: {
        calendarId,
        calendarName: updatedCalendar.name,
        previousOwnerId,
        newOwnerId,
        newOwnerEmail: newOwner.email,
        transferredBy: currentUser.email,
        assignedToSelf: body.assignToSelf === true,
      },
    });

    return NextResponse.json({
      message: "Calendar ownership transferred successfully",
      calendar: updatedCalendar,
    });
  } catch (error) {
    console.error("[Admin Calendar Transfer API] Error:", error);

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
      { error: "Failed to transfer calendar ownership" },
      { status: 500 }
    );
  }
}
