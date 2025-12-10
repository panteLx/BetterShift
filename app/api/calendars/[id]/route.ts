import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/password-utils";

// GET single calendar
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

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

    // Verify password if calendar is protected AND locked
    if (calendar.passwordHash && calendar.isLocked) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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

// PATCH update calendar
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color, password, currentPassword, isLocked } = body;

    // Fetch current calendar to check password
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

    // Always verify password if calendar is protected
    if (existingCalendar.passwordHash) {
      if (
        !currentPassword ||
        !verifyPassword(currentPassword, existingCalendar.passwordHash)
      ) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    const updateData: Partial<typeof calendars.$inferInsert> = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;
    if (password !== undefined) {
      updateData.passwordHash = password ? hashPassword(password) : null;
      // If removing password, also unlock calendar
      if (password === null) {
        updateData.isLocked = false;
      }
    }
    if (isLocked !== undefined) {
      // Only allow locking if password exists or is being set
      if (isLocked && !existingCalendar.passwordHash && !password) {
        return NextResponse.json(
          { error: "Cannot lock calendar without password" },
          { status: 400 }
        );
      }
      updateData.isLocked = isLocked;
    }

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

// DELETE calendar
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

    // Fetch calendar to check password
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

    // Verify password if calendar is protected
    if (calendar.passwordHash) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
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
