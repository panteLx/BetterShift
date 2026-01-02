import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, calendars, session, calendarShares } from "@/lib/db/schema";
import { sql, eq, desc, and, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin User Management API
 *
 * GET /api/admin/users
 * Lists all users with filtering, sorting, and pagination.
 *
 * Query Parameters:
 * - role: Filter by role (superadmin, admin, user)
 * - banned: Filter by ban status (true, false)
 * - search: Search by name or email (case-insensitive)
 * - sortBy: Sort field (createdAt, name, email, role)
 * - sortOrder: Sort direction (asc, desc)
 * - limit: Number of users to return (default: 1000)
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
    const roleFilter = searchParams.get("role");
    const bannedFilter = searchParams.get("banned");
    const searchQuery = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const conditions = [];

    if (roleFilter) {
      conditions.push(eq(user.role, roleFilter));
    }

    if (bannedFilter !== null) {
      const isBanned = bannedFilter === "true";
      conditions.push(eq(user.banned, isBanned));
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${user.email}) LIKE ${searchPattern}`,
          sql`LOWER(${user.name}) LIKE ${searchPattern}`
        )
      );
    }

    // Apply sorting
    const sortField =
      sortBy === "createdAt"
        ? user.createdAt
        : sortBy === "name"
        ? user.name
        : sortBy === "email"
        ? user.email
        : sortBy === "role"
        ? user.role
        : user.createdAt;

    const orderByClause = sortOrder === "asc" ? sortField : desc(sortField);

    // Get total count (with filters)
    const countQuery = db.select({ count: sql<number>`COUNT(*)` }).from(user);

    const [countResult] =
      conditions.length > 0
        ? await countQuery.where(and(...conditions))
        : await countQuery;

    const total = Number(countResult?.count || 0);

    // Get users (with filters, sorting, pagination)
    const usersQuery = db
      .select()
      .from(user)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const users =
      conditions.length > 0
        ? await usersQuery.where(and(...conditions))
        : await usersQuery;

    // Enrich users with calendar count and last activity
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        // Count owned calendars
        const [calendarCount] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(calendars)
          .where(eq(calendars.ownerId, u.id));

        // Count shared calendars (via calendarShares)
        const [sharesCount] = await db
          .select({
            count: sql<number>`COUNT(*)`,
          })
          .from(calendarShares)
          .where(eq(calendarShares.userId, u.id));

        // Get last session (most recent activity)
        const [lastSession] = await db
          .select({
            updatedAt: session.updatedAt,
          })
          .from(session)
          .where(eq(session.userId, u.id))
          .orderBy(desc(session.updatedAt))
          .limit(1);

        return {
          ...u,
          role: u.role || "user",
          banned: u.banned || false,
          calendarCount: Number(calendarCount?.count || 0),
          sharesCount: Number(sharesCount?.count || 0),
          lastActivity: lastSession?.updatedAt || null,
        };
      })
    );

    return NextResponse.json({
      users: enrichedUsers,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
