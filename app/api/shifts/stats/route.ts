import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shifts, icloudSyncs } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, or, isNull } from "drizzle-orm";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";

// GET shift statistics for a calendar
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");
    const period = searchParams.get("period") || "month"; // week, month, year
    const date = searchParams.get("date"); // reference date for the period

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    const referenceDate = date ? new Date(date) : new Date();

    let startDate: Date;
    let endDate: Date;

    // Determine date range based on period
    switch (period) {
      case "week":
        startDate = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(referenceDate, { weekStartsOn: 1 });
        break;
      case "year":
        startDate = startOfYear(referenceDate);
        endDate = endOfYear(referenceDate);
        break;
      case "month":
      default:
        startDate = startOfMonth(referenceDate);
        endDate = endOfMonth(referenceDate);
        break;
    }

    // Fetch shifts for the period, excluding shifts from iCloud syncs that are hidden or hidden from stats
    const result = await db
      .select({
        title: shifts.title,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(shifts)
      .leftJoin(icloudSyncs, eq(shifts.icloudSyncId, icloudSyncs.id))
      .where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startDate),
          lte(shifts.date, endDate),
          // Exclude shifts from iCloud syncs that are hidden or hidden from stats
          or(
            isNull(shifts.icloudSyncId),
            and(
              eq(icloudSyncs.isHidden, false),
              eq(icloudSyncs.hideFromStats, false)
            )
          )
        )
      )
      .groupBy(shifts.title)
      .orderBy(sql`count(*) DESC`);

    // Transform result to object format
    const stats = result.reduce((acc, item) => {
      acc[item.title] = Number(item.count);
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch shift statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift statistics" },
      { status: 500 }
    );
  }
}
