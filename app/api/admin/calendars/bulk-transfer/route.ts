import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars as calendarsTable,
  organization,
  user as userTable,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin, canTransferCalendar } from "@/lib/auth/admin";
import { logAuditEvent, type AdminCalendarBulkTransferMetadata } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import { MULTI_TENANT } from "@/lib/auth/env";
import { ensureWorkspaceMember } from "@/lib/workspace-membership-end";

/**
 * Admin Calendar Bulk Transfer API
 *
 * POST /api/admin/calendars/bulk-transfer
 * Transfers multiple calendars to a different user.
 *
 * Body:
 * - calendarIds: string[] - Array of calendar IDs to transfer
 * - newOwnerId: string - User ID to transfer to
 *
 * Multi-tenant: the new owner joins every affected workspace they are not yet in as
 * `member`, in the same transaction.
 *
 * Permission: Admin or Superadmin
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Rate limiting: admin-bulk-operations (strictest limit)
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-bulk-operations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!canTransferCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const calendarIds: string[] = body.calendarIds;
    const newOwnerId: string = body.newOwnerId;

    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json(
        { error: "calendarIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!newOwnerId) {
      return NextResponse.json(
        { error: "newOwnerId is required" },
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

    const workspaceIds = Array.from(new Set(calendars.map((c) => c.workspaceId)));
    const foundIds = calendars.map((c) => c.id);

    const addedIds = db.transaction((tx) => {
      const added: string[] = [];
      if (MULTI_TENANT) {
        for (const workspaceId of workspaceIds) {
          if (ensureWorkspaceMember(tx, workspaceId, newOwnerId)) added.push(workspaceId);
        }
      }
      tx.update(calendarsTable)
        .set({ ownerId: newOwnerId })
        .where(inArray(calendarsTable.id, foundIds))
        .run();
      return added;
    });

    const addedToWorkspaces =
      addedIds.length > 0
        ? await db
            .select({ id: organization.id, slug: organization.slug })
            .from(organization)
            .where(inArray(organization.id, addedIds))
        : [];

    // Audit log
    await logAuditEvent<AdminCalendarBulkTransferMetadata>({
      request,
      action: "admin.calendar.bulk_transfer",
      userId: currentUser.id,
      severity: "warning",
      metadata: {
        count: calendars.length,
        calendarIds,
        calendarNames: calendars.map((c) => c.name),
        newOwnerId,
        newOwnerEmail: newOwner.email,
        transferredBy: currentUser.email,
        previousOwners: calendars.map((c) => ({
          calendarId: c.id,
          previousOwnerId: c.ownerId,
        })),
        addedToWorkspaces,
      },
    });

    return NextResponse.json({
      message: `${calendars.length} calendar(s) transferred successfully`,
      transferredCount: calendars.length,
      calendarIds,
      newOwnerId,
      addedToWorkspaces,
    });
  } catch (error) {
    console.error("[Admin Calendar Bulk Transfer API] Error:", error);

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
      { error: "Failed to transfer calendars" },
      { status: 500 }
    );
  }
}
