import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarNotes, calendars } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability, hasOwnedCapability } from "@/lib/auth/permissions";
import { parseLocalDate, withCalendarDay } from "@/lib/date-utils";

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
    const hasAccess = await hasCapability(user?.id, calendar.id, "viewNotesEvents");
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
      let targetDate;
      try {
        targetDate = parseLocalDate(date);
      } catch {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

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
      return NextResponse.json(result.map(withCalendarDay));
    }

    const result = await query;
    return NextResponse.json(result.map(withCalendarDay));
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

    // Check permissions (works for both authenticated users and guests).
    // Creating needs either capability — own vs. any only matters once the
    // note exists, for editing/deleting it. The caller is the note's future
    // creator, so passing their id as createdBy folds that check in too.
    const user = await getSessionUser(request.headers);
    const hasAccess = await hasOwnedCapability(
      user?.id,
      calendar.id,
      "manageOwnNotesEvents",
      "manageAnyNotesEvents",
      user?.id ?? null
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    let parsedDate;
    try {
      parsedDate = parseLocalDate(date);
    } catch {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const [calendarNote] = await db
      .insert(calendarNotes)
      .values({
        calendarId,
        date: parsedDate,
        note,
        type: type || "note",
        color: color || null,
        recurringPattern: recurringPattern || "none",
        recurringInterval: recurringInterval || null,
        createdBy: user?.id ?? null,
      })
      .returning();

    return NextResponse.json(withCalendarDay(calendarNote));
  } catch (error) {
    console.error("Failed to create calendar note:", error);
    return NextResponse.json(
      { error: "Failed to create calendar note" },
      { status: 500 }
    );
  }
}
