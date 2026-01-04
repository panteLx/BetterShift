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
import { sql, eq, and, gte, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { requireAdmin } from "@/lib/auth/admin";

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

    requireAdmin(currentUser);

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

    // 2. Total calendars (exclude orphaned)
    const [totalCalendarsResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(calendars)
      .where(sql`${calendars.ownerId} IS NOT NULL`);

    const totalCalendars = Number(totalCalendarsResult?.count || 0);

    // 3. Orphaned calendars (ownerId = NULL)
    const [orphanedCalendarsResult] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(calendars)
      .where(isNull(calendars.ownerId));

    const orphanedCalendars = Number(orphanedCalendarsResult?.count || 0);

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

    // 7. Recent audit logs preview (last 5 entries, admin-only logs + security events)
    const recentLogs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        userId: auditLogs.userId,
        severity: auditLogs.severity,
        timestamp: auditLogs.timestamp,
      })
      .from(auditLogs)
      .where(
        sql`(${auditLogs.action} LIKE 'admin.%' OR ${auditLogs.action} LIKE 'security.%')` // Admin actions + security events (rate limits, etc.) - both user-visible and admin-only
      )
      .orderBy(sql`${auditLogs.timestamp} DESC`)
      .limit(5);

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
        logs: recentLogs,
      },
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
