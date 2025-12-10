import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarNotes, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { verifyPassword } from "@/lib/password-utils";

// GET single calendar note
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

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

    // Fetch calendar to check password
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

    // Verify password if calendar is protected AND locked
    if (calendar.passwordHash && calendar.isLocked) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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
    const { note, password } = body;

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

    // Fetch calendar to check password
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

    // Verify password if calendar is protected
    if (calendar.passwordHash) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    const [updated] = await db
      .update(calendarNotes)
      .set({
        note,
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

    // Read password from request body
    let password: string | null = null;
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      try {
        const body = await request.json();
        password = body.password || null;
      } catch {
        // If body parsing fails, continue with null password
      }
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

    // Fetch calendar to check password
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

    // Verify password if calendar is protected
    if (calendar.passwordHash) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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
