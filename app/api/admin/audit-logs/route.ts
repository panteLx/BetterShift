import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs, user } from "@/lib/db/schema";
import { sql, eq, desc, and, or, lt } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import { logAdminAction } from "@/lib/audit-log";

/**
 * Admin Audit Logs API
 *
 * GET /api/admin/audit-logs
 * View all audit logs with filtering, sorting, and pagination.
 *
 * Query Parameters:
 * - action: Filter by action type (e.g., "admin.user.ban", "calendar.create")
 * - userId: Filter by specific user ID
 * - resourceType: Filter by resource type (e.g., "user", "calendar")
 * - resourceId: Filter by specific resource ID
 * - severity: Filter by severity (info, warning, error, critical)
 * - search: Search in action, resourceType, or metadata (case-insensitive)
 * - startDate: Filter logs after this date (ISO string)
 * - endDate: Filter logs before this date (ISO string)
 * - sortBy: Sort field (timestamp, action, severity)
 * - sortOrder: Sort direction (asc, desc)
 * - limit: Number of logs to return (default: 50, max: 500)
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
    const actionFilter = searchParams.get("action");
    const userIdFilter = searchParams.get("userId");
    const resourceTypeFilter = searchParams.get("resourceType");
    const resourceIdFilter = searchParams.get("resourceId");
    const severityFilter = searchParams.get("severity");
    const searchQuery = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "timestamp";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "25", 10),
      500
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const conditions = [];

    // Action filter (supports prefix matching)
    if (actionFilter) {
      if (actionFilter.endsWith(".")) {
        // Prefix match (e.g., "admin." matches "admin.user.ban")
        const searchPattern = `${actionFilter}%`;
        conditions.push(sql`${auditLogs.action} LIKE ${searchPattern}`);
      } else {
        // Exact match
        conditions.push(eq(auditLogs.action, actionFilter));
      }
    }

    // User filter
    if (userIdFilter) {
      conditions.push(eq(auditLogs.userId, userIdFilter));
    }

    // Resource type filter
    if (resourceTypeFilter) {
      conditions.push(eq(auditLogs.resourceType, resourceTypeFilter));
    }

    // Resource ID filter
    if (resourceIdFilter) {
      conditions.push(eq(auditLogs.resourceId, resourceIdFilter));
    }

    // Severity filter
    if (severityFilter) {
      const validSeverities = ["info", "warning", "error", "critical"];
      if (validSeverities.includes(severityFilter)) {
        conditions.push(eq(auditLogs.severity, severityFilter));
      }
    }

    // Search filter (action, resourceType, or metadata)
    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${auditLogs.action}) LIKE ${searchPattern}`,
          sql`LOWER(${auditLogs.resourceType}) LIKE ${searchPattern}`,
          sql`LOWER(${auditLogs.metadata}) LIKE ${searchPattern}`
        )
      );
    }

    // Date range filters
    if (startDate) {
      const startTimestamp = new Date(startDate);
      if (!isNaN(startTimestamp.getTime())) {
        // Set to start of day (00:00:00)
        startTimestamp.setHours(0, 0, 0, 0);
        // Convert to Unix timestamp (seconds)
        const unixTimestamp = Math.floor(startTimestamp.getTime() / 1000);
        conditions.push(sql`${auditLogs.timestamp} >= ${unixTimestamp}`);
      }
    }

    if (endDate) {
      const endTimestamp = new Date(endDate);
      if (!isNaN(endTimestamp.getTime())) {
        // Set to end of day (23:59:59)
        endTimestamp.setHours(23, 59, 59, 999);
        // Convert to Unix timestamp (seconds)
        const unixTimestamp = Math.floor(endTimestamp.getTime() / 1000);
        conditions.push(sql`${auditLogs.timestamp} <= ${unixTimestamp}`);
      }
    }

    // Apply sorting
    let orderByClause;

    if (sortBy === "user") {
      // Sort by user name, fallback to email, then null last
      const userSortExpr = sql`COALESCE(${user.name}, ${user.email}, 'zzz')`;
      orderByClause = sortOrder === "asc" ? userSortExpr : desc(userSortExpr);
    } else if (sortBy === "ipAddress") {
      // Sort by IP address, nulls last
      const ipSortExpr = sql`COALESCE(${auditLogs.ipAddress}, 'zzz')`;
      orderByClause = sortOrder === "asc" ? ipSortExpr : desc(ipSortExpr);
    } else {
      const sortField =
        sortBy === "action"
          ? auditLogs.action
          : sortBy === "severity"
          ? auditLogs.severity
          : auditLogs.timestamp;
      orderByClause = sortOrder === "asc" ? sortField : desc(sortField);
    }

    // Get total count (with filters)
    const countQuery = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(auditLogs);

    const [countResult] =
      conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

    const total = Number(countResult?.count || 0);

    // Get logs with user information
    const logsQuery = db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        severity: auditLogs.severity,
        isUserVisible: auditLogs.isUserVisible,
        timestamp: auditLogs.timestamp,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.userId, user.id))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const logs =
      conditions.length > 0
        ? await logsQuery.where(and(...conditions))
        : await logsQuery;

    // Parse metadata JSON strings
    const logsWithParsedMetadata = logs.map((log) => ({
      ...log,
      metadata: log.metadata ? tryParseJSON(log.metadata) : null,
      timestamp: log.timestamp.toISOString(),
    }));

    return NextResponse.json({
      logs: logsWithParsedMetadata,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("[Admin Audit Logs] Error fetching logs:", error);

    if (error instanceof Error && "status" in error) {
      return NextResponse.json(
        { error: error.message },
        { status: (error as { status: number }).status }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/audit-logs
 * Delete old audit logs (bulk operation).
 *
 * Delete Methods:
 * 1. Query Parameter: ?before=2024-01-01 (delete logs older than date)
 * 2. Request Body: { logIds: [...] } (delete specific logs by ID)
 *
 * Permission: Superadmin only
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    // Only superadmins can delete audit logs
    if (currentUser.role !== "superadmin") {
      return NextResponse.json(
        { error: "Superadmin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const beforeDate = searchParams.get("before");

    let deletedCount = 0;

    // Method 1: Delete by date (query parameter)
    if (beforeDate) {
      const beforeTimestamp = new Date(beforeDate);

      if (isNaN(beforeTimestamp.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }

      const result = await db
        .delete(auditLogs)
        .where(lt(auditLogs.timestamp, beforeTimestamp))
        .returning({ id: auditLogs.id });

      deletedCount = result.length;

      // Log admin action
      await logAdminAction({
        action: "admin.audit_log.delete_by_date",
        userId: currentUser.id,
        metadata: {
          beforeDate: beforeTimestamp.toISOString(),
          deletedCount,
          deletedBy: currentUser.email,
        },
        request,
      });

      return NextResponse.json({
        success: true,
        deletedCount,
        beforeDate: beforeTimestamp.toISOString(),
      });
    }

    // Method 2: Delete by IDs (request body)
    const body = await request.json().catch(() => ({}));
    const { logIds } = body;

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Either 'before' query parameter or 'logIds' in body is required",
        },
        { status: 400 }
      );
    }

    // Delete logs by IDs
    const deletePromises = logIds.map((id) =>
      db
        .delete(auditLogs)
        .where(eq(auditLogs.id, id))
        .returning({ id: auditLogs.id })
    );

    const results = await Promise.all(deletePromises);
    deletedCount = results.filter((r) => r.length > 0).length;

    // Log admin action
    await logAdminAction({
      action: "admin.audit_log.delete_by_ids",
      userId: currentUser.id,
      metadata: {
        logIds,
        deletedCount,
        deletedBy: currentUser.email,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      requestedCount: logIds.length,
    });
  } catch (error) {
    console.error("[Admin Audit Logs] Error deleting logs:", error);

    if (error instanceof Error && "status" in error) {
      return NextResponse.json(
        { error: error.message },
        { status: (error as { status: number }).status }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete audit logs" },
      { status: 500 }
    );
  }
}

/**
 * Helper function to safely parse JSON strings
 */
function tryParseJSON(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString; // Return as string if parsing fails
  }
}
