import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user, calendars, session, calendarShares } from "@/lib/db/schema";
import { and, asc, count, desc, getTableColumns, getTableName, or, sql, type SQL } from "drizzle-orm";
import { isAdmin } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import {
  SORT_ORDERS,
  USER_ROLE_FILTERS,
  USER_SORT_FIELDS,
  USER_STATUS_FILTERS,
  clampPage,
  containsPattern,
  parsePaging,
  pickParam,
  type UserListCounts,
} from "@/lib/admin-list";

/**
 * Admin User Management API
 *
 * GET /api/admin/users
 * One page of users plus instance-wide counts.
 *
 * Query Parameters:
 * - search: Name or email contains (case-insensitive)
 * - role: all | superadmin | admin | user (default: all; "user" includes accounts without a role)
 * - status: all | active | banned (default: all)
 * - sort: name | email | role | status | createdAt | lastActivity | calendarCount (default: createdAt)
 * - order: asc | desc (default: desc)
 * - page: 1-based page, clamped to the last page (default: 1)
 * - limit: Page size (default: 25, max: 100)
 *
 * Response: { items, total, counts, page, limit } — see lib/admin-list.ts
 *
 * Permission: Admin or Superadmin only
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    if (!isAdmin(currentUser)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const search = (searchParams.get("search") ?? "").trim();
    const role = pickParam(searchParams.get("role"), USER_ROLE_FILTERS, "all");
    const status = pickParam(searchParams.get("status"), USER_STATUS_FILTERS, "all");
    const sort = pickParam(searchParams.get("sort"), USER_SORT_FIELDS, "createdAt");
    const order = pickParam(searchParams.get("order"), SORT_ORDERS, "desc");
    const paging = parsePaging(searchParams);

    // Single-table selects render columns unqualified, so the outer row is named explicitly
    const userId = sql`${sql.identifier(getTableName(user))}.${sql.identifier(user.id.name)}`;
    const calendarCount = sql<number>`(select count(*) from ${calendars} where ${calendars.ownerId} = ${userId})`;
    const sharesCount = sql<number>`(select count(*) from ${calendarShares} where ${calendarShares.userId} = ${userId})`;
    const lastActivity = sql<number | null>`(select max(${session.updatedAt}) from ${session} where ${session.userId} = ${userId})`;
    const isPrivileged = sql`coalesce(${user.role}, 'user') in ('admin', 'superadmin')`;
    const roleRank = sql`case ${user.role} when 'superadmin' then 2 when 'admin' then 1 else 0 end`;
    const bannedFlag = sql`coalesce(${user.banned}, 0)`;

    const conditions: SQL[] = [];

    if (role === "user") {
      conditions.push(sql`not ${isPrivileged}`);
    } else if (role !== "all") {
      conditions.push(sql`${user.role} = ${role}`);
    }

    if (status !== "all") {
      conditions.push(sql`${bannedFlag} = ${status === "banned" ? 1 : 0}`);
    }

    if (search) {
      const pattern = containsPattern(search);
      conditions.push(
        or(
          sql`lower(${user.name}) like ${pattern} escape '\\'`,
          sql`lower(${user.email}) like ${pattern} escape '\\'`
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortExpressions: Record<typeof sort, SQL | typeof user.createdAt> = {
      name: sql`lower(${user.name})`,
      email: sql`lower(${user.email})`,
      role: roleRank,
      status: bannedFlag,
      createdAt: user.createdAt,
      lastActivity,
      calendarCount,
    };
    const direction = order === "asc" ? asc : desc;

    const [[{ total }], [countRow]] = await Promise.all([
      db.select({ total: count() }).from(user).where(where),
      db
        .select({
          total: count(),
          superadmin: sql<number>`coalesce(sum(${user.role} = 'superadmin'), 0)`,
          admin: sql<number>`coalesce(sum(${user.role} = 'admin'), 0)`,
          banned: sql<number>`coalesce(sum(${bannedFlag} = 1), 0)`,
        })
        .from(user),
    ]);

    const { page, offset } = clampPage(paging.page, paging.limit, total);

    const rows = await db
      .select({
        ...getTableColumns(user),
        calendarCount,
        sharesCount,
        lastActivity,
      })
      .from(user)
      .where(where)
      // The id tie-breaker keeps pages stable when many rows share a sort value
      .orderBy(direction(sortExpressions[sort]), direction(user.id))
      .limit(paging.limit)
      .offset(offset);

    const items = rows.map((row) => ({
      ...row,
      role: row.role || "user",
      banned: row.banned || false,
      calendarCount: Number(row.calendarCount),
      sharesCount: Number(row.sharesCount),
      lastActivity: row.lastActivity === null ? null : new Date(Number(row.lastActivity)),
    }));

    const superadmin = Number(countRow.superadmin);
    const admin = Number(countRow.admin);
    const banned = Number(countRow.banned);
    const counts: UserListCounts = {
      total: countRow.total,
      superadmin,
      admin,
      user: countRow.total - superadmin - admin,
      banned,
      active: countRow.total - banned,
    };

    return NextResponse.json({
      items,
      total,
      counts,
      page,
      limit: paging.limit,
    });
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
