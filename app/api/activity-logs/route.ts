import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, syncLogs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { getUserAccessibleCalendars } from "@/lib/auth/permissions";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";

// Unified activity log format
interface UnifiedActivityLog {
  id: string;
  type: "sync" | "auth" | "calendar" | "security";
  action: string;
  timestamp: Date;
  severity: string;
  metadata: object | null;
  resourceType?: string;
  resourceId?: string;
}

/**
 * GET /api/activity-logs - List user's visible activity logs (merged from auditLogs + syncLogs)
 *
 * Query params:
 * - type: Filter by action type prefix (security, calendar, sync, auth)
 * - startDate: ISO date string (inclusive)
 * - endDate: ISO date string (inclusive)
 * - page: Page number (0-based, default: 0)
 * - limit: Items per page (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.headers);

  // Require authentication to view activity logs
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // e.g., "auth", "calendar", "sync", "security"
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const severity = searchParams.get("severity"); // e.g., "info", "warning", "error", "critical"
  const search = searchParams.get("search"); // search text for action/metadata
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  try {
    // Fetch all logs and merge them before pagination
    const allLogs: UnifiedActivityLog[] = [];

    // ============================================
    // 1. Fetch auditLogs (if not filtering by sync type only)
    // ============================================
    if (!type || type !== "sync") {
      const auditConditions = [
        eq(auditLogs.isUserVisible, true),
        eq(auditLogs.userId, user.id),
      ];

      // Filter by action type prefix (but exclude sync if type is specified)
      if (type && type !== "sync") {
        auditConditions.push(sql`${auditLogs.action} LIKE ${type + ".%"}`);
      }

      // Filter by severity
      if (severity) {
        auditConditions.push(eq(auditLogs.severity, severity));
      }

      // Filter by date range
      if (startDate) {
        const start = new Date(startDate);
        auditConditions.push(gte(auditLogs.timestamp, start));
      }

      if (endDate) {
        const end = new Date(endDate);
        auditConditions.push(lte(auditLogs.timestamp, end));
      }

      const auditLogsData = await db
        .select()
        .from(auditLogs)
        .where(and(...auditConditions))
        .orderBy(desc(auditLogs.timestamp));

      // Convert auditLogs to unified format
      for (const log of auditLogsData) {
        const actionParts = log.action.split(".");
        const logType =
          actionParts[0] === "auth"
            ? "auth"
            : actionParts[0] === "security"
            ? "security"
            : "calendar";

        allLogs.push({
          id: log.id,
          type: logType as "auth" | "security" | "calendar",
          action: log.action,
          timestamp: log.timestamp,
          severity: log.severity,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
          resourceType: log.resourceType ?? undefined,
          resourceId: log.resourceId ?? undefined,
        });
      }
    }

    // ============================================
    // 2. Fetch syncLogs (if not filtering by non-sync types)
    // ============================================
    if (!type || type === "sync") {
      // Get all calendars user has access to
      const accessibleCalendars = await getUserAccessibleCalendars(user.id);
      const calendarIds = accessibleCalendars.map((cal) => cal.id);

      if (calendarIds.length > 0) {
        const syncConditions = [inArray(syncLogs.calendarId, calendarIds)];

        // Filter by date range
        if (startDate) {
          const start = new Date(startDate);
          syncConditions.push(gte(syncLogs.syncedAt, start));
        }

        if (endDate) {
          const end = new Date(endDate);
          syncConditions.push(lte(syncLogs.syncedAt, end));
        }

        const syncLogsData = await db
          .select()
          .from(syncLogs)
          .where(and(...syncConditions))
          .orderBy(desc(syncLogs.syncedAt));

        // Convert syncLogs to unified format
        for (const log of syncLogsData) {
          const action =
            log.status === "success"
              ? "sync.executed.success"
              : "sync.executed.failed";

          allLogs.push({
            id: log.id,
            type: "sync",
            action,
            timestamp: log.syncedAt,
            severity: log.status === "success" ? "info" : "warning",
            metadata: {
              externalSyncId: log.externalSyncId,
              externalSyncName: log.externalSyncName,
              shiftsCreated: log.shiftsCreated,
              shiftsUpdated: log.shiftsUpdated,
              shiftsDeleted: log.shiftsDeleted,
              syncType: log.syncType,
              errorMessage: log.errorMessage ?? undefined,
            },
            resourceType: "sync",
            resourceId: log.externalSyncId,
          });
        }
      }
    }

    // ============================================
    // 3. Apply severity filter after merging (sync logs derive severity from status)
    // ============================================
    let filteredLogs = allLogs;
    if (severity) {
      filteredLogs = filteredLogs.filter((log) => log.severity === severity);
    }

    // ============================================
    // 4. Apply search filter (search in action and metadata)
    // ============================================
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter((log) => {
        // Search in action
        if (log.action.toLowerCase().includes(searchLower)) return true;
        // Search in metadata
        if (log.metadata) {
          const metadataStr = JSON.stringify(log.metadata).toLowerCase();
          if (metadataStr.includes(searchLower)) return true;
        }
        // Search in resourceType or resourceId
        if (log.resourceType?.toLowerCase().includes(searchLower)) return true;
        if (log.resourceId?.toLowerCase().includes(searchLower)) return true;
        return false;
      });
    }

    // ============================================
    // 5. Sort merged logs by timestamp (descending)
    // ============================================
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // ============================================
    // 6. Apply pagination to filtered results
    // ============================================
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    const total = filteredLogs.length;

    return NextResponse.json({
      logs: paginatedLogs,
      total,
      offset,
      limit,
      hasMore: offset + paginatedLogs.length < total,
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activity-logs - Clear user's activity logs
 *
 * Only deletes logs where:
 * - userId = currentUser
 * - isUserVisible = true
 * Cannot delete admin/system logs.
 */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete user-visible audit logs
    await db
      .delete(auditLogs)
      .where(
        and(eq(auditLogs.userId, user.id), eq(auditLogs.isUserVisible, true))
      );

    // Delete sync logs for user's calendars
    const accessibleCalendars = await getUserAccessibleCalendars(user.id);
    const calendarIds = accessibleCalendars.map((cal) => cal.id);

    if (calendarIds.length > 0) {
      await db
        .delete(syncLogs)
        .where(inArray(syncLogs.calendarId, calendarIds));
    }

    return NextResponse.json({
      success: true,
      message: "Activity logs cleared",
    });
  } catch (error) {
    console.error("Error clearing activity logs:", error);
    return NextResponse.json(
      { error: "Failed to clear activity logs" },
      { status: 500 }
    );
  }
}
