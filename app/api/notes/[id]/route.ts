import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarNotes, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

// GET single calendar note
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.id, id));

    if (!result[0]) {
      return NextResponse.json(
        { error: "Calendar note not found" },
        { status: 404 }
      );
    }

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, result[0].calendarId));

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

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Failed to fetch calendar note:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar note" },
      { status: 500 }
    );
  }
}

// PUT update calendar note
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { note, type, color, recurringPattern, recurringInterval } = body;

    if (!note) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    // Fetch existing note to get calendar ID
    const [existingNote] = await db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.id, id));

    if (!existingNote) {
      return NextResponse.json(
        { error: "Calendar note not found" },
        { status: 404 }
      );
    }

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, existingNote.calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const user = await getSessionUser(request.headers);
    if (user && !(await canEditCalendar(user.id, calendar.id))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Determine the final type value
    const finalType = type !== undefined ? type : existingNote.type;

    const [updated] = await db
      .update(calendarNotes)
      .set({
        note,
        type: finalType,
        // Clear event-specific fields when converting to note
        color:
          finalType === "note"
            ? null
            : color !== undefined
            ? color
            : existingNote.color,
        recurringPattern:
          finalType === "note"
            ? "none"
            : recurringPattern !== undefined
            ? recurringPattern
            : existingNote.recurringPattern,
        recurringInterval:
          finalType === "note"
            ? null
            : recurringInterval !== undefined
            ? recurringInterval
            : existingNote.recurringInterval,
        updatedAt: new Date(),
      })
      .where(eq(calendarNotes.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Calendar note not found" },
        { status: 404 }
      );
    }

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "note",
      action: "update",
      calendarId: updated.calendarId,
      data: updated,
    } as CalendarChangeEvent);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update calendar note:", error);
    return NextResponse.json(
      { error: "Failed to update calendar note" },
      { status: 500 }
    );
  }
}

// DELETE calendar note
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch existing note to get calendar ID
    const [existingNote] = await db
      .select()
      .from(calendarNotes)
      .where(eq(calendarNotes.id, id));

    if (!existingNote) {
      return NextResponse.json(
        { error: "Calendar note not found" },
        { status: 404 }
      );
    }

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, existingNote.calendarId));

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

    const result = await db
      .delete(calendarNotes)
      .where(eq(calendarNotes.id, id))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: "Calendar note not found" },
        { status: 404 }
      );
    }

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "note",
      action: "delete",
      calendarId: result[0].calendarId,
      data: { id },
    } as CalendarChangeEvent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete calendar note:", error);
    return NextResponse.json(
      { error: "Failed to delete calendar note" },
      { status: 500 }
    );
  }
}
