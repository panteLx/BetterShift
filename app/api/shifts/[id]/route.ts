import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";

// GET single shift
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

    const result = await db
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
      .where(eq(shifts.id, id));

    if (!result[0]) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
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
    console.error("Failed to fetch shift:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift" },
      { status: 500 }
    );
  }
}

// PATCH update shift
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      date,
      startTime,
      endTime,
      title,
      color,
      notes,
      isAllDay,
      isSecondary,
      password,
    } = body;

    // Fetch shift to get calendar ID
    const [existingShift] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, id));

    if (!existingShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, existingShift.calendarId));

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

    const updateData: Partial<typeof shifts.$inferInsert> = {};
    if (date) updateData.date = new Date(date);
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (title) updateData.title = title;
    if (color) updateData.color = color;
    if (notes !== undefined) updateData.notes = notes;
    if (isAllDay !== undefined) updateData.isAllDay = isAllDay;
    if (isSecondary !== undefined) updateData.isSecondary = isSecondary;

    const [shift] = await db
      .update(shifts)
      .set(updateData)
      .where(eq(shifts.id, id))
      .returning();

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "shift",
      action: "update",
      calendarId: existingShift.calendarId,
      data: { ...shift, calendar },
    } as CalendarChangeEvent);

    return NextResponse.json({ ...shift, calendar });
  } catch (error) {
    console.error("Failed to update shift:", error);
    return NextResponse.json(
      { error: "Failed to update shift" },
      { status: 500 }
    );
  }
}

// DELETE shift
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

    // Fetch shift to get calendar ID
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, shift.calendarId));

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

    await db.delete(shifts).where(eq(shifts.id, id));

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "shift",
      action: "delete",
      calendarId: shift.calendarId,
      data: { id },
    } as CalendarChangeEvent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete shift:", error);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}
