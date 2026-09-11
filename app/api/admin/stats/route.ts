import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  user,
  calendars,
  calendarShares,
  calendarAccessTokens,
  shifts,
  auditLogs,
} from "@/lib/db/schema";
import { sql, eq, and, gte, count, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { isAdmin } from "@/lib/auth/admin";

const RECENT_LOG_LIMIT = 5;

function parseMetadata(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Admin System Statistics API
 *
 * GET /api/admin/stats
 * Returns system-wide statistics for admin dashboard.
 *
 * Permission: Admin or Superadmin only
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request.headers);

    if (!sessionUser) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get full user from DB to check admin role
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!isAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Calculate date for "recent activity" (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Total users by role
    const usersQuery = await db
      .select({
        role: user.role,
        count: sql<number>`COUNT(*)`,
      })
      .from(user)
      .groupBy(user.role);

    const usersByRole = {
      superadmin: 0,
      admin: 0,
      user: 0,
      total: 0,
    };

    usersQuery.forEach((row) => {
      const count = Number(row.count);
      if (row.role === "superadmin") {
        usersByRole.superadmin = count;
      } else if (row.role === "admin") {
        usersByRole.admin = count;
      } else {
        // null or "user" role
        usersByRole.user = count;
      }
      usersByRole.total += count;
    });

    // 2./3. Calendars with an owner row vs. orphaned (owner_id null or dangling)
    const [calendarCounts] = await db
      .select({
        total: count(),
        orphaned: sql<number>`coalesce(sum(${user.id} is null), 0)`,
      })
      .from(calendars)
      .leftJoin(user, eq(calendars.ownerId, user.id));

    const orphanedCalendars = Number(calendarCounts?.orphaned || 0);
    const totalCalendars = Number(calendarCounts?.total || 0) - orphanedCalendars;

    // 4. Active shares count (user shares)
    const [activeSharesResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarShares);

    const activeShares = Number(activeSharesResult?.count || 0);

    // 4a. Active token shares count
    const [activeTokenSharesResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarAccessTokens)
      .where(eq(calendarAccessTokens.isActive, true));

    const activeTokenShares = Number(activeTokenSharesResult?.count || 0);

    // 5. Total shifts count
    const [totalShiftsResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(shifts);

    const totalShifts = Number(totalShiftsResult?.count || 0);

    // 6. Recent activity count (last 7 days)
    const [recentActivityResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(auditLogs)
      .where(and(gte(auditLogs.timestamp, sevenDaysAgo)));

    const recentActivity = Number(recentActivityResult?.count || 0);

    // 7. Dashboard feed: admin actions plus security events, with metadata for the summaries
    const feedScope = sql`(${auditLogs.action} LIKE 'admin.%' OR ${auditLogs.action} LIKE 'security.%')`;

    const recentLogs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        userId: auditLogs.userId,
        metadata: auditLogs.metadata,
        severity: auditLogs.severity,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .where(feedScope)
      // Timestamps have second precision; rowid keeps same-second entries in insert order
      .orderBy(desc(auditLogs.timestamp), desc(sql`rowid`))
      .limit(RECENT_LOG_LIMIT);

    const [feedTotal] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(feedScope);

    // 8. All audit log entries, for the sidebar and area links
    const [auditLogTotal] = await db.select({ count: count() }).from(auditLogs);

    const stats = {
      users: usersByRole,
      calendars: {
        total: totalCalendars,
        orphaned: orphanedCalendars,
      },
      shares: {
        user: activeShares,
        token: activeTokenShares,
        active: activeShares + activeTokenShares,
      },
      shifts: {
        total: totalShifts,
      },
      activity: {
        recent: recentActivity,
        total: feedTotal?.count ?? 0,
        logs: recentLogs.map((log) => ({
          ...log,
          metadata: parseMetadata(log.metadata),
        })),
      },
      auditLogs: {
        total: auditLogTotal?.count ?? 0,
      },
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
