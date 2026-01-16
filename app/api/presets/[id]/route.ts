import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, shifts, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

// GET single preset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    const [preset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar
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

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, preset.calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
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
    } = body;

    const user = await getSessionUser(request.headers);

    // Fetch preset to get calendar ID
    const [existingPreset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!existingPreset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar
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

    // Check edit permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(
      user?.id,
      existingPreset.calendarId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
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
    const user = await getSessionUser(request.headers);

    // Fetch preset to get calendar ID
    const [preset] = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.id, id));

    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Fetch calendar
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

    // Check edit permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(user?.id, preset.calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Delete all shifts that were created from this preset
    await db.delete(shifts).where(eq(shifts.presetId, id));

    // Delete the preset
    await db.delete(shiftPresets).where(eq(shiftPresets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting preset:", error);
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    );
  }
}
