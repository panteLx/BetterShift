import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts, externalSyncs } from "@/lib/db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
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

    const query = db
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
        syncedFromExternal: shifts.syncedFromExternal,
        externalSyncId: shifts.externalSyncId,
        createdAt: shifts.createdAt,
        updatedAt: shifts.updatedAt,
        calendar: {
          id: calendars.id,
          name: calendars.name,
          color: calendars.color,
        },
      })
      .from(shifts)
      .leftJoin(calendars, eq(shifts.calendarId, calendars.id))
      .leftJoin(externalSyncs, eq(shifts.externalSyncId, externalSyncs.id));

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const result = await query.where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startOfDay),
          lte(shifts.date, endOfDay),
          // Exclude shifts from hidden external syncs (or shifts that are not synced)
          or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
        )
      );
      return NextResponse.json(result);
    }

    const result = await query.where(
      and(
        eq(shifts.calendarId, calendarId),
        // Exclude shifts from hidden external syncs (or shifts that are not synced)
        or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
      )
    );
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
      password,
    } = body;

    if (!calendarId || !date || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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

    // Verify password if calendar is protected
    if (calendar.passwordHash) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

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
