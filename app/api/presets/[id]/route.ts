import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, shifts, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";

// GET single preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

    const [preset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, preset.calendarId));

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

    return NextResponse.json(preset);
  } catch (error) {
    console.error("Failed to fetch preset:", error);
    return NextResponse.json(
      { error: "Failed to fetch preset" },
      { status: 500 }
    );
  }
}

// PATCH update a preset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      startTime,
      endTime,
      color,
      notes,
      isSecondary,
      isAllDay,
      hideFromStats,
      password,
    } = body;

    // Fetch preset to get calendar ID
    const [existingPreset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!existingPreset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, existingPreset.calendarId));

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

    const [updatedPreset] = await db
      .update(shiftPresets)
      .set({
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color,
        notes: notes || null,
        isSecondary: isSecondary !== undefined ? isSecondary : undefined,
        isAllDay: isAllDay !== undefined ? isAllDay : undefined,
        hideFromStats: hideFromStats !== undefined ? hideFromStats : undefined,
        updatedAt: new Date(),
      })
      .where(eq(shiftPresets.id, id))
      .returning();

    // Update all shifts that were created from this preset
    await db
      .update(shifts)
      .set({
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color,
        notes: notes || null,
        isAllDay: isAllDay !== undefined ? isAllDay : undefined,
        updatedAt: new Date(),
      })
      .where(eq(shifts.presetId, id));

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "preset",
      action: "update",
      calendarId: existingPreset.calendarId,
      data: updatedPreset,
    } as CalendarChangeEvent);

    return NextResponse.json(updatedPreset);
  } catch (error) {
    console.error("Error updating preset:", error);
    return NextResponse.json(
      { error: "Failed to update preset" },
      { status: 500 }
    );
  }
}

// DELETE a preset
export async function DELETE(
  request: NextRequest,
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

    // Fetch preset to get calendar ID
    const [preset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, preset.calendarId));

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

    // Delete all shifts that were created from this preset
    await db.delete(shifts).where(eq(shifts.presetId, id));

    // Delete the preset
    await db.delete(shiftPresets).where(eq(shiftPresets.id, id));

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "preset",
      action: "delete",
      calendarId: preset.calendarId,
      data: { id },
    } as CalendarChangeEvent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting preset:", error);
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    );
  }
}
