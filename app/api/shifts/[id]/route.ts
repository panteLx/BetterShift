import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

// GET single shift
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

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

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, result[0].calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
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

// PATCH update shift (requires write permission)
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
    } = body;

    const user = await getSessionUser(request.headers);

    // Fetch shift to get calendar ID
    const [existingShift] = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, id));

    if (!existingShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Fetch calendar
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

    // Check write permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(user?.id, existingShift.calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
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

// DELETE shift (requires write permission)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    // Fetch shift to get calendar ID
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check write permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(user?.id, shift.calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
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
