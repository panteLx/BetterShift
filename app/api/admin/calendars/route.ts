import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  user,
  shifts,
  calendarNotes,
  shiftPresets,
  calendarShares,
  calendarAccessTokens,
  externalSyncs,
} from "@/lib/db/schema";
import { sql, eq, and, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin Calendar Management API
 *
 * GET /api/admin/calendars
 * Lists all calendars with filtering, sorting, and pagination.
 *
 * Query Parameters:
 * - status: Filter by status (all, orphaned, owned)
 * - search: Search by calendar name (case-insensitive)
 * - ownerId: Filter by specific owner ID
 * - sortBy: Sort field (name, createdAt, ownerId, shiftCount)
 * - sortOrder: Sort direction (asc, desc)
 * - limit: Number of calendars to return (default: 1000)
 * - offset: Pagination offset
 *
 * Permission: Admin or Superadmin only
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const searchQuery = searchParams.get("search");
    const ownerIdFilter = searchParams.get("ownerId");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const conditions = [];

    // Status filter
    if (statusFilter === "orphaned") {
      conditions.push(isNull(calendars.ownerId));
    } else if (statusFilter === "with-owner") {
      conditions.push(sql`${calendars.ownerId} IS NOT NULL`);
    }

    // Owner filter
    if (ownerIdFilter) {
      conditions.push(eq(calendars.ownerId, ownerIdFilter));
    }

    // Search filter
    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      conditions.push(sql`LOWER(${calendars.name}) LIKE ${searchPattern}`);
    }

    // Base query with calendar data
    const baseQuery = db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        ownerId: calendars.ownerId,
        guestPermission: calendars.guestPermission,
        createdAt: sql<string>`${calendars.createdAt}`,
        updatedAt: sql<string>`${calendars.updatedAt}`,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerImage: user.image,
      })
      .from(calendars)
      .leftJoin(user, eq(calendars.ownerId, user.id));

    // Get total count
    const countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(calendars);

    const [countResult] =
      conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

    const total = Number(countResult?.count || 0);

    // Get calendars with owner info
    const calendarsQuery =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    const calendarsData = await calendarsQuery.limit(limit).offset(offset);

    // Get statistics for each calendar
    const calendarIds = calendarsData.map((c) => c.id);

    // Get shift counts
    const shiftCounts = await db
      .select({
        calendarId: shifts.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(shifts)
      .where(sql`${shifts.calendarId} IN ${calendarIds}`)
      .groupBy(shifts.calendarId);

    // Get note counts
    const noteCounts = await db
      .select({
        calendarId: calendarNotes.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarNotes)
      .where(sql`${calendarNotes.calendarId} IN ${calendarIds}`)
      .groupBy(calendarNotes.calendarId);

    // Get preset counts
    const presetCounts = await db
      .select({
        calendarId: shiftPresets.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(shiftPresets)
      .where(sql`${shiftPresets.calendarId} IN ${calendarIds}`)
      .groupBy(shiftPresets.calendarId);

    // Get share counts
    const shareCounts = await db
      .select({
        calendarId: calendarShares.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarShares)
      .where(sql`${calendarShares.calendarId} IN ${calendarIds}`)
      .groupBy(calendarShares.calendarId);

    // Get share token counts
    const shareTokenCounts = await db
      .select({
        calendarId: calendarAccessTokens.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarAccessTokens)
      .where(sql`${calendarAccessTokens.calendarId} IN ${calendarIds}`)
      .groupBy(calendarAccessTokens.calendarId);

    // Get external syncs counts
    const externalSyncsCounts = await db
      .select({
        calendarId: externalSyncs.calendarId,
        count: sql<number>`COUNT(*)`,
      })
      .from(externalSyncs)
      .where(sql`${externalSyncs.calendarId} IN ${calendarIds}`)
      .groupBy(externalSyncs.calendarId);

    // Build result with statistics
    const calendarsWithStats = calendarsData.map((calendar) => ({
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
      guestPermission: calendar.guestPermission,
      createdAt: calendar.createdAt ? new Date(calendar.createdAt) : new Date(),
      updatedAt: calendar.updatedAt ? new Date(calendar.updatedAt) : new Date(),
      shiftsCount:
        shiftCounts.find((s) => s.calendarId === calendar.id)?.count || 0,
      notesCount:
        noteCounts.find((n) => n.calendarId === calendar.id)?.count || 0,
      presetsCount:
        presetCounts.find((p) => p.calendarId === calendar.id)?.count || 0,
      sharesCount:
        (shareCounts.find((s) => s.calendarId === calendar.id)?.count || 0) +
        (shareTokenCounts.find((t) => t.calendarId === calendar.id)?.count ||
          0),
      externalSyncsCount:
        externalSyncsCounts.find((e) => e.calendarId === calendar.id)?.count ||
        0,
    }));

    // Apply sorting
    const sortedCalendars = calendarsWithStats.sort((a, b) => {
      // Orphaned calendars always on top (when not filtering)
      if (statusFilter === "all") {
        const aOrphaned = !a.ownerId;
        const bOrphaned = !b.ownerId;
        if (aOrphaned !== bOrphaned) {
          return aOrphaned ? -1 : 1;
        }
      }

      // Then sort by specified field
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "createdAt") {
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "ownerId") {
        const aOwner = a.owner?.name || a.owner?.email || "";
        const bOwner = b.owner?.name || b.owner?.email || "";
        comparison = aOwner.localeCompare(bOwner);
      } else if (sortBy === "shiftCount") {
        comparison = a.shiftsCount - b.shiftsCount;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return NextResponse.json({
      calendars: sortedCalendars,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Admin Calendars API] Error:", error);

    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}
