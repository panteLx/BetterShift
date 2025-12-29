import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  shifts,
  externalSyncs,
  shiftPresets,
  calendars,
} from "@/lib/db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar } from "@/lib/auth/permissions";
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

    const user = await getSessionUser(request.headers);

    // Fetch calendar
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

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
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

    // Fetch shifts for the period, excluding shifts from iCloud syncs or presets that are hidden from stats
    const result = await db
      .select({
        id: shifts.id,
        title: shifts.title,
        date: shifts.date,
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
    const dailyStats = new Map<
      string,
      { count: number; totalMinutes: number }
    >();
    let minDuration = Infinity;
    let maxDuration = 0;
    let nonAllDayShiftCount = 0; // Track shifts with duration for accurate average

    result.forEach((shift) => {
      const existing = statsMap.get(shift.title) || {
        count: 0,
        totalMinutes: 0,
      };
      existing.count++;
      const duration = shift.isAllDay
        ? 0
        : calculateShiftDuration(shift.startTime, shift.endTime);
      existing.totalMinutes += duration;
      statsMap.set(shift.title, existing);

      // Count non-all-day shifts for average calculation
      if (!shift.isAllDay) {
        nonAllDayShiftCount++;
      }

      // Track min/max duration (exclude all-day shifts)
      if (!shift.isAllDay && duration > 0) {
        minDuration = Math.min(minDuration, duration);
        maxDuration = Math.max(maxDuration, duration);
      }

      // Daily breakdown for trend analysis
      const shiftDate = shift.date;
      if (shiftDate) {
        try {
          // Handle both Date objects and Unix timestamps (in seconds for SQLite)
          const date =
            shiftDate instanceof Date
              ? shiftDate
              : typeof shiftDate === "number"
              ? new Date(shiftDate * 1000) // Convert seconds to milliseconds
              : new Date(shiftDate);

          if (!isNaN(date.getTime())) {
            const dateKey = date.toISOString().split("T")[0];
            const dailyExisting = dailyStats.get(dateKey) || {
              count: 0,
              totalMinutes: 0,
            };
            dailyExisting.count++;
            dailyExisting.totalMinutes += duration;
            dailyStats.set(dateKey, dailyExisting);
          }
        } catch {
          // Skip invalid dates
        }
      }
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

    // Calculate total duration and averages
    const totalMinutes = Object.values(stats).reduce(
      (sum, data) => sum + data.totalMinutes,
      0
    );

    const totalShifts = result.length;
    const avgMinutesPerShift =
      nonAllDayShiftCount > 0 ? totalMinutes / nonAllDayShiftCount : 0;

    // Calculate days with shifts for accurate daily average
    const daysWithShifts = dailyStats.size;
    const avgShiftsPerDay =
      daysWithShifts > 0 ? totalShifts / daysWithShifts : 0;
    const avgMinutesPerDay =
      daysWithShifts > 0 ? totalMinutes / daysWithShifts : 0;

    // Convert daily stats to array for trend visualization
    const trendData = Array.from(dailyStats.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        totalMinutes: data.totalMinutes,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats,
      totalMinutes,
      totalShifts,
      avgMinutesPerShift: Math.round(avgMinutesPerShift),
      avgShiftsPerDay: Math.round(avgShiftsPerDay * 10) / 10,
      avgMinutesPerDay: Math.round(avgMinutesPerDay),
      minDuration: minDuration === Infinity ? 0 : minDuration,
      maxDuration,
      daysWithShifts,
      trendData,
    });
  } catch (error) {
    console.error("Failed to fetch shift statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift statistics" },
      { status: 500 }
    );
  }
}
