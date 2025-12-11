import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  shifts,
  externalSyncs,
  shiftPresets,
  calendars,
} from "@/lib/db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
import { calculateShiftDuration } from "@/lib/date-utils";
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

    const password = searchParams.get("password");

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Verify password if calendar is protected AND locked
    if (calendar.passwordHash && calendar.isLocked) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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

    // Fetch shifts for the period, excluding shifts from iCloud syncs or presets that are hidden from stats
    const result = await db
      .select({
        title: shifts.title,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        isAllDay: shifts.isAllDay,
      })
      .from(shifts)
      .leftJoin(externalSyncs, eq(shifts.externalSyncId, externalSyncs.id))
      .leftJoin(shiftPresets, eq(shifts.presetId, shiftPresets.id))
      .where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startDate),
          lte(shifts.date, endDate),
          // Exclude shifts from iCloud syncs that are hidden or hidden from stats
          or(
            isNull(shifts.externalSyncId),
            and(
              eq(externalSyncs.isHidden, false),
              eq(externalSyncs.hideFromStats, false)
            )
          ),
          // Exclude shifts from presets that are hidden from stats
          or(isNull(shifts.presetId), eq(shiftPresets.hideFromStats, false))
        )
      );

    // Group by title and calculate stats
    const statsMap = new Map<string, { count: number; totalMinutes: number }>();

    result.forEach((shift) => {
      const existing = statsMap.get(shift.title) || {
        count: 0,
        totalMinutes: 0,
      };
      existing.count++;
      existing.totalMinutes += shift.isAllDay
        ? 0
        : calculateShiftDuration(shift.startTime, shift.endTime);
      statsMap.set(shift.title, existing);
    });

    // Transform result to object format
    const stats = Array.from(statsMap.entries()).reduce(
      (acc, [title, data]) => {
        acc[title] = {
          count: data.count,
          totalMinutes: data.totalMinutes,
        };
        return acc;
      },
      {} as Record<string, { count: number; totalMinutes: number }>
    );

    // Calculate total duration
    const totalMinutes = Object.values(stats).reduce(
      (sum, data) => sum + data.totalMinutes,
      0
    );

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats,
      totalMinutes,
    });
  } catch (error) {
    console.error("Failed to fetch shift statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift statistics" },
      { status: 500 }
    );
  }
}
