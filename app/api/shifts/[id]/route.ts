import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET single shift
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    } = body;

    const updateData: any = {};
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

    // Fetch calendar info
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, shift.calendarId));

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
