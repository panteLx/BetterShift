import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete shift:", error);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}

// PUT/UPDATE shift (requires write permission)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);
    const body = await request.json();

    // Fetch shift to get calendar ID
    const [existingShift] = await db.select().from(shifts).where(eq(shifts.id, id));

    if (!existingShift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check if shift is externally synced (read-only)
    if (existingShift.externalSyncId || existingShift.syncedFromExternal) {
      return NextResponse.json(
        { error: "Cannot edit externally synced shifts. They are read-only." },
        { status: 403 }
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

    // Update the shift
    const [updatedShift] = await db
      .update(shifts)
      .set({
        date: body.date ? new Date(body.date) : existingShift.date,
        startTime: body.startTime ?? existingShift.startTime,
        endTime: body.endTime ?? existingShift.endTime,
        title: body.title ?? existingShift.title,
        color: body.color ?? existingShift.color,
        notes: body.notes ?? existingShift.notes,
        isAllDay: body.isAllDay ?? existingShift.isAllDay,
        presetId: body.presetId ?? existingShift.presetId,
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, id))
      .returning();

    return NextResponse.json(updatedShift);
  } catch (error) {
    console.error("Failed to update shift:", error);
    return NextResponse.json(
      { error: "Failed to update shift" },
      { status: 500 }
    );
  }
}
