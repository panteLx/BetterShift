import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import {
  canViewCalendar,
  canManageCalendar,
  canDeleteCalendar,
} from "@/lib/auth/permissions";

// GET single calendar
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check read permission (if auth is enabled)
    if (user && !(await canViewCalendar(user.id, id))) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const calendarShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.calendarId, id))
      .orderBy(shifts.date);

    return NextResponse.json({ ...calendar, shifts: calendarShifts });
  } catch (error) {
    console.error("Failed to fetch calendar:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}

// PATCH update calendar (requires admin permission)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);
    const body = await request.json();
    const { name, color } = body;

    // Fetch current calendar
    const [existingCalendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!existingCalendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check admin permission (if auth is enabled)
    if (user && !(await canManageCalendar(user.id, id))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin access required." },
        { status: 403 }
      );
    }

    const updateData: Partial<typeof calendars.$inferInsert> = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;

    const [calendar] = await db
      .update(calendars)
      .set(updateData)
      .where(eq(calendars.id, id))
      .returning();

    return NextResponse.json(calendar);
  } catch (error) {
    console.error("Failed to update calendar:", error);
    return NextResponse.json(
      { error: "Failed to update calendar" },
      { status: 500 }
    );
  }
}

// DELETE calendar (requires owner permission)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check owner permission (if auth is enabled)
    if (user && !(await canDeleteCalendar(user.id, id))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Owner access required." },
        { status: 403 }
      );
    }

    await db.delete(calendars).where(eq(calendars.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete calendar:", error);
    return NextResponse.json(
      { error: "Failed to delete calendar" },
      { status: 500 }
    );
  }
}
