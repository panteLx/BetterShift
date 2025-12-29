import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarNotes, calendars } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

// GET calendar notes for a calendar (with optional date filter)
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

    // Check permissions (works for both authenticated users and guests)
    const user = await getSessionUser(request.headers);
    const hasAccess = await canViewCalendar(user?.id, calendar.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const query = db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.calendarId, calendarId));

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const result = await db
        .select()
        .from(calendarNotes)
        .where(
          and(
            eq(calendarNotes.calendarId, calendarId),
            gte(calendarNotes.date, startOfDay),
            lte(calendarNotes.date, endOfDay)
          )
        );
      return NextResponse.json(result);
    }

    const result = await query;
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch calendar notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar notes" },
      { status: 500 }
    );
  }
}

// POST create new calendar note
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
      date,
      note,
      type,
      color,
      recurringPattern,
      recurringInterval,
    } = body;

    if (!calendarId || !date || !note) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate type field
    if (type && type !== "note" && type !== "event") {
      return NextResponse.json(
        { error: "Invalid type. Must be 'note' or 'event'" },
        { status: 400 }
      );
    }

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

    // Check permissions (works for both authenticated users and guests)
    const user = await getSessionUser(request.headers);
    const hasAccess = await canEditCalendar(user?.id, calendar.id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const [calendarNote] = await db
      .insert(calendarNotes)
      .values({
        calendarId,
        date: new Date(date),
        note,
        type: type || "note",
        color: color || null,
        recurringPattern: recurringPattern || "none",
        recurringInterval: recurringInterval || null,
      })
      .returning();

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "note",
      action: "create",
      calendarId,
      data: calendarNote,
    } as CalendarChangeEvent);

    return NextResponse.json(calendarNote);
  } catch (error) {
    console.error("Failed to create calendar note:", error);
    return NextResponse.json(
      { error: "Failed to create calendar note" },
      { status: 500 }
    );
  }
}
