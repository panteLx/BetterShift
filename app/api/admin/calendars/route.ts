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
import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { isAdmin } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import {
  CALENDAR_CONTENT_FILTERS,
  CALENDAR_OWNER_FILTERS,
  CALENDAR_SORT_FIELDS,
  SORT_ORDERS,
  clampPage,
  containsPattern,
  parsePaging,
  pickParam,
  type CalendarListCounts,
} from "@/lib/admin-list";

// A calendar is orphaned when it has no owner row, whether owner_id is null or dangling
const orphaned = sql`${user.id} is null`;
const hasUserShares = sql`exists (select 1 from ${calendarShares} where ${calendarShares.calendarId} = ${calendars.id})`;
const hasTokens = sql`exists (select 1 from ${calendarAccessTokens} where ${calendarAccessTokens.calendarId} = ${calendars.id})`;
const hasSyncs = sql`exists (select 1 from ${externalSyncs} where ${externalSyncs.calendarId} = ${calendars.id})`;
const isShared = sql`(${hasUserShares} or ${hasTokens})`;

/** Timestamps defaulted by SQLite are "YYYY-MM-DD HH:MM:SS" text in UTC; app-written ones are unix seconds. */
function toDate(value: unknown): Date {
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return new Date(Number(value) * 1000);
    const utc = new Date(`${value.replace(" ", "T")}Z`);
    return isNaN(utc.getTime()) ? new Date(value) : utc;
  }
  return new Date();
}

/** Per-row count as a correlated subquery, so one page is one statement. */
function countFor(table: SQLiteTable, column: SQLiteColumn) {
  return sql<number>`(select count(*) from ${table} where ${column} = ${calendars.id})`;
}

/**
 * Admin Calendar Management API
 *
 * GET /api/admin/calendars
 * One page of calendars plus instance-wide counts. Orphaned calendars always come first.
 *
 * Query Parameters:
 * - search: Calendar name, owner name or owner email contains (case-insensitive)
 * - content: all | shared | synced (default: all; shared = user shares or share links)
 * - owner: all | orphaned | with-owner (default: all)
 * - sort: name | createdAt | owner | shiftsCount | sharesCount | externalSyncsCount | guestPermission (default: createdAt)
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
    const content = pickParam(searchParams.get("content"), CALENDAR_CONTENT_FILTERS, "all");
    const owner = pickParam(searchParams.get("owner"), CALENDAR_OWNER_FILTERS, "all");
    const sort = pickParam(searchParams.get("sort"), CALENDAR_SORT_FIELDS, "createdAt");
    const order = pickParam(searchParams.get("order"), SORT_ORDERS, "desc");
    const paging = parsePaging(searchParams);

    const conditions: SQL[] = [];

    if (owner === "orphaned") conditions.push(orphaned);
    if (owner === "with-owner") conditions.push(sql`not ${orphaned}`);
    if (content === "shared") conditions.push(isShared);
    if (content === "synced") conditions.push(hasSyncs);

    if (search) {
      const pattern = containsPattern(search);
      conditions.push(
        or(
          sql`lower(${calendars.name}) like ${pattern} escape '\\'`,
          sql`lower(${user.name}) like ${pattern} escape '\\'`,
          sql`lower(${user.email}) like ${pattern} escape '\\'`
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortExpressions: Record<typeof sort, SQL> = {
      name: sql`lower(${calendars.name})`,
      createdAt: sql`${calendars.createdAt}`,
      owner: sql`lower(coalesce(${user.name}, ${user.email}, ''))`,
      shiftsCount: sql`(select count(*) from ${shifts} where ${shifts.calendarId} = ${calendars.id})`,
      sharesCount: sql`((select count(*) from ${calendarShares} where ${calendarShares.calendarId} = ${calendars.id}) + (select count(*) from ${calendarAccessTokens} where ${calendarAccessTokens.calendarId} = ${calendars.id}))`,
      externalSyncsCount: sql`(select count(*) from ${externalSyncs} where ${externalSyncs.calendarId} = ${calendars.id})`,
      guestPermission: sql`case ${calendars.guestPermission} when 'write' then 2 when 'read' then 1 else 0 end`,
    };
    const direction = order === "asc" ? asc : desc;

    const [[{ total }], [countRow], [shiftsRow]] = await Promise.all([
      db
        .select({ total: count() })
        .from(calendars)
        .leftJoin(user, eq(calendars.ownerId, user.id))
        .where(where),
      db
        .select({
          total: count(),
          orphaned: sql<number>`coalesce(sum(${orphaned}), 0)`,
          shared: sql<number>`coalesce(sum(${isShared}), 0)`,
          synced: sql<number>`coalesce(sum(${hasSyncs}), 0)`,
        })
        .from(calendars)
        .leftJoin(user, eq(calendars.ownerId, user.id)),
      db.select({ total: count() }).from(shifts),
    ]);

    const { page, offset } = clampPage(paging.page, paging.limit, total);

    const rows = await db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        ownerId: calendars.ownerId,
        guestPermission: calendars.guestPermission,
        // Raw values: rows created with the SQL default hold text, not unix seconds
        createdAt: sql<unknown>`${calendars.createdAt}`,
        updatedAt: sql<unknown>`${calendars.updatedAt}`,
        ownerUserId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerImage: user.image,
        shiftsCount: countFor(shifts, shifts.calendarId),
        notesCount: countFor(calendarNotes, calendarNotes.calendarId),
        presetsCount: countFor(shiftPresets, shiftPresets.calendarId),
        userSharesCount: countFor(calendarShares, calendarShares.calendarId),
        tokenSharesCount: countFor(calendarAccessTokens, calendarAccessTokens.calendarId),
        externalSyncsCount: countFor(externalSyncs, externalSyncs.calendarId),
      })
      .from(calendars)
      .leftJoin(user, eq(calendars.ownerId, user.id))
      .where(where)
      .orderBy(
        asc(sql`case when ${orphaned} then 0 else 1 end`),
        direction(sortExpressions[sort]),
        direction(calendars.id)
      )
      .limit(paging.limit)
      .offset(offset);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      ownerId: row.ownerId,
      owner: row.ownerUserId
        ? { name: row.ownerName, email: row.ownerEmail, image: row.ownerImage }
        : null,
      guestPermission: row.guestPermission,
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
      shiftsCount: Number(row.shiftsCount),
      notesCount: Number(row.notesCount),
      presetsCount: Number(row.presetsCount),
      sharesCount: Number(row.userSharesCount) + Number(row.tokenSharesCount),
      externalSyncsCount: Number(row.externalSyncsCount),
    }));

    const counts: CalendarListCounts = {
      total: countRow.total,
      orphaned: Number(countRow.orphaned),
      shared: Number(countRow.shared),
      synced: Number(countRow.synced),
      shifts: shiftsRow.total,
    };

    return NextResponse.json({
      items,
      total,
      counts,
      page,
      limit: paging.limit,
    });
  } catch (error) {
    console.error("[Admin Calendars API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}
