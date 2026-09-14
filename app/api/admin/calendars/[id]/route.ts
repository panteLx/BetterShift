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
  siteAdminCanEditCalendar,
  siteAdminCanDeleteCalendar,
} from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import {
  getBundleForCalendar,
  resolveGuestEligibleBundle,
} from "@/lib/auth/permission-bundles-service";

/**
 * Admin Calendar Detail API
 *
 * GET /api/admin/calendars/[id]
 * Returns detailed information about a specific calendar.
 *
 * PATCH /api/admin/calendars/[id]
 * Updates calendar information (name, color, guestBundleId).
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
        guestBundleId: calendarsTable.guestBundleId,
        createdAt: sql<string>`${calendarsTable.createdAt}`,
        updatedAt: sql<string>`${calendarsTable.updatedAt}`,
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
        bundleId: calendarSharesTable.bundleId,
        createdAt: calendarSharesTable.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        userImage: userTable.image,
      })
      .from(calendarSharesTable)
      .leftJoin(userTable, eq(calendarSharesTable.userId, userTable.id))
      .where(eq(calendarSharesTable.calendarId, calendarId));

    // Get share tokens
    const shareTokens = await db
      .select({
        id: tokensTable.id,
        name: tokensTable.name,
        bundleId: tokensTable.bundleId,
        createdAt: sql<string>`${tokensTable.createdAt}`,
      })
      .from(tokensTable)
      .where(eq(tokensTable.calendarId, calendarId));

    // Get share token count
    const [shareTokenCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(tokensTable)
      .where(eq(tokensTable.calendarId, calendarId));

    // Get external syncs with last sync info
    const externalSyncs = await db
      .select({
        id: externalSyncsTable.id,
        name: externalSyncsTable.name,
        syncType: externalSyncsTable.syncType,
        url: externalSyncsTable.calendarUrl,
        createdAt: sql<string>`${externalSyncsTable.createdAt}`,
      })
      .from(externalSyncsTable)
      .where(eq(externalSyncsTable.calendarId, calendarId));

    // Get last synced timestamp for each external sync
    const externalSyncsWithLastSync = await Promise.all(
      externalSyncs.map(async (sync) => {
        const [lastSync] = await db
          .select({ syncedAt: syncLogsTable.syncedAt })
          .from(syncLogsTable)
          .where(eq(syncLogsTable.externalSyncId, sync.id))
          .orderBy(sql`${syncLogsTable.syncedAt} DESC`)
          .limit(1);

        return {
          ...sync,
          lastSyncedAt: lastSync?.syncedAt ? new Date(lastSync.syncedAt) : null,
        };
      })
    );

    // Get external syncs count
    const [externalSyncCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(externalSyncsTable)
      .where(eq(externalSyncsTable.calendarId, calendarId));

    // Batch-resolve every bundle involved (guest, shares, tokens) to its
    // {id, name, seedKey} for display — the admin panel now shows the
    // owner-defined bundle directly instead of a collapsed read/write/admin
    // tier (Paket 6). Shares/tokens always resolve (bundleId is a restrict
    // FK); a guest bundle can be orphaned (no FK, see 4.2 in the plan) and
    // then correctly falls back to null, i.e. "no guest access".
    const bundleIds = new Set<string>();
    if (calendar.guestBundleId) bundleIds.add(calendar.guestBundleId);
    for (const s of shares) bundleIds.add(s.bundleId);
    for (const t of shareTokens) bundleIds.add(t.bundleId);
    const bundleRows =
      bundleIds.size > 0
        ? await db.query.calendarPermissionBundles.findMany({
            where: (b, { inArray }) => inArray(b.id, Array.from(bundleIds)),
            columns: { id: true, name: true, seedKey: true },
          })
        : [];
    const bundleById = new Map(bundleRows.map((b) => [b.id, b]));
    const guestBundle = calendar.guestBundleId
      ? (bundleById.get(calendar.guestBundleId) ?? null)
      : null;

    return NextResponse.json({
      id: calendar.id,
      name: calendar.name,
      color: calendar.color,
      ownerId: calendar.ownerId,
      owner: calendar.ownerId
        ? {
            name: calendar.ownerName,
            email: calendar.ownerEmail,
            image: calendar.ownerImage,
          }
        : null,
      guestBundle,
      createdAt: calendar.createdAt ? new Date(calendar.createdAt) : new Date(),
      updatedAt: calendar.updatedAt ? new Date(calendar.updatedAt) : new Date(),
      shiftsCount: Number(shiftCount?.count || 0),
      notesCount: Number(noteCount?.count || 0),
      presetsCount: Number(presetCount?.count || 0),
      sharesCount:
        Number(shareCount?.count || 0) + Number(shareTokenCount?.count || 0),
      externalSyncsCount: Number(externalSyncCount?.count || 0),
      shares: shares.map((s) => ({
        userId: s.userId,
        userName: s.userName || "",
        userEmail: s.userEmail || "",
        userImage: s.userImage,
        bundle: bundleById.get(s.bundleId) ?? { id: s.bundleId, name: "?", seedKey: null },
      })),
      shareTokens: shareTokens.map((t) => ({
        id: t.id,
        name: t.name,
        bundle: bundleById.get(t.bundleId) ?? { id: t.bundleId, name: "?", seedKey: null },
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
      })),
      externalSyncs: externalSyncsWithLastSync,
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

    // Rate limiting: admin-calendar-mutations
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-calendar-mutations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!siteAdminCanEditCalendar(currentUser)) {
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
      guestBundleId?: string | null;
    } = {};
    const changes: string[] = [];

    // Validate and collect allowed updates
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Invalid calendar name" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
      changes.push("name");
    }

    if (body.color !== undefined) {
      if (typeof body.color !== "string") {
        return NextResponse.json(
          { error: "Invalid color format" },
          { status: 400 }
        );
      }
      updates.color = body.color;
      changes.push("color");
    }

    let newGuestBundle: Awaited<ReturnType<typeof resolveGuestEligibleBundle>> | null =
      null;
    if (body.guestBundleId !== undefined) {
      if (body.guestBundleId === null) {
        updates.guestBundleId = null;
      } else if (typeof body.guestBundleId === "string") {
        newGuestBundle = await resolveGuestEligibleBundle(
          calendarId,
          body.guestBundleId,
          "Bundle contains capabilities that cannot be granted to guests"
        );
        if (newGuestBundle instanceof NextResponse) return newGuestBundle;
        updates.guestBundleId = body.guestBundleId;
      } else {
        return NextResponse.json(
          { error: "Invalid guestBundleId" },
          { status: 400 }
        );
      }
      changes.push("guestBundleId");
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
          guestBundleId: calendar.guestBundleId,
        },
        newValues: updates,
        updatedBy: currentUser.email,
      },
    });

    // Reuse the already-validated bundle when this request set it, instead
    // of re-fetching the same row.
    let guestBundle: { id: string; name: string; seedKey: string | null } | null = null;
    if (newGuestBundle) {
      guestBundle = {
        id: newGuestBundle.id,
        name: newGuestBundle.name,
        seedKey: newGuestBundle.seedKey,
      };
    } else if (updatedCalendar.guestBundleId) {
      const bundle = await getBundleForCalendar(calendarId, updatedCalendar.guestBundleId);
      guestBundle = bundle ? { id: bundle.id, name: bundle.name, seedKey: bundle.seedKey } : null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping guestBundleId in favor of the guestBundle object below
    const { guestBundleId: _guestBundleId, ...calendarResponse } = updatedCalendar;
    return NextResponse.json({ ...calendarResponse, guestBundle });
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

    // Rate limiting: admin-calendar-mutations
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-calendar-mutations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!siteAdminCanDeleteCalendar(currentUser)) {
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
