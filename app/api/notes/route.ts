import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarNotes, calendars } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { verifyPassword } from "@/lib/password-utils";

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
    const { calendarId, date, note, password } = body;

    if (!calendarId || !date || !note) {
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

    const [calendarNote] = await db
      .insert(calendarNotes)
      .values({
        calendarId,
        date: new Date(date),
        note,
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
