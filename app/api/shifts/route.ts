import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";

// GET shifts for a calendar (with optional date filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");
    const date = searchParams.get("date");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    let query = db
      .select({
        id: shifts.id,
        calendarId: shifts.calendarId,
        date: shifts.date,
        startTime: shifts.startTime,
        endTime: shifts.endTime,
        title: shifts.title,
        color: shifts.color,
        notes: shifts.notes,
        isAllDay: shifts.isAllDay,
        isSecondary: shifts.isSecondary,
        icloudSyncId: shifts.icloudSyncId,
        createdAt: shifts.createdAt,
        updatedAt: shifts.updatedAt,
        calendar: {
          id: calendars.id,
          name: calendars.name,
          color: calendars.color,
        },
      })
      .from(shifts)
      .leftJoin(calendars, eq(shifts.calendarId, calendars.id));

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const result = await query.where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startOfDay),
          lte(shifts.date, endOfDay)
        )
      );
      return NextResponse.json(result);
    }

    const result = await query.where(eq(shifts.calendarId, calendarId));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}

// POST create new shift
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
      date,
      startTime,
      endTime,
      title,
      color,
      notes,
      presetId,
      isAllDay,
      isSecondary,
    } = body;

    if (!calendarId || !date || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const [shift] = await db
      .insert(shifts)
      .values({
        calendarId,
        presetId: presetId || null,
        date: new Date(date),
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        title,
        color: color || "#3b82f6",
        notes: notes || null,
        isAllDay: isAllDay || false,
        isSecondary: isSecondary || false,
      })
      .returning();

    // Fetch calendar info
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "shift",
      action: "create",
      calendarId,
      data: { ...shift, calendar },
    } as CalendarChangeEvent);

    return NextResponse.json({ ...shift, calendar }, { status: 201 });
  } catch (error) {
    console.error("Failed to create shift:", error);
    return NextResponse.json(
      { error: "Failed to create shift" },
      { status: 500 }
    );
  }
}
