import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, calendars } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

// GET all presets for a calendar
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "calendarId is required" },
        { status: 400 }
      );
    }

    const user = await getSessionUser(request.headers);

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const presets = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.calendarId, calendarId))
      .orderBy(asc(shiftPresets.order));
    return NextResponse.json(presets);
  } catch (error) {
    console.error("Error fetching presets:", error);
    return NextResponse.json(
      { error: "Failed to fetch presets" },
      { status: 500 }
    );
  }
}

// POST create a new preset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      calendarId,
      title,
      startTime,
      endTime,
      color,
      notes,
      isSecondary,
      isAllDay,
      hideFromStats,
    } = body;

    if (!calendarId || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await getSessionUser(request.headers);

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check edit permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get the max order value for this calendar to append new preset at the end
    const existingPresets = await db
      .select()
      .from(shiftPresets)
      .where(eq(shiftPresets.calendarId, calendarId));

    const maxOrder =
      existingPresets.length > 0
        ? Math.max(...existingPresets.map((p) => p.order || 0))
        : -1;

    const [preset] = await db
      .insert(shiftPresets)
      .values({
        calendarId,
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color: color || "#3b82f6",
        notes: notes || null,
        isSecondary: isSecondary || false,
        isAllDay: isAllDay || false,
        hideFromStats: hideFromStats || false,
        order: maxOrder + 1,
      })
      .returning();

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "preset",
      action: "create",
      calendarId,
      data: preset,
    } as CalendarChangeEvent);

    return NextResponse.json(preset);
  } catch (error) {
    console.error("Error creating preset:", error);
    return NextResponse.json(
      { error: "Failed to create preset" },
      { status: 500 }
    );
  }
}
