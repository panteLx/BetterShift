import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, calendars } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { trimOrNull } from "@/lib/utils";
import { replacePresetSegments, withPresetSegments } from "@/lib/shift-time-ranges";
import { normalizeTimeRanges, toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
import {
  getCalendarCustomFields,
  withPresetCustomFields,
  resolveCustomFieldValues,
  replacePresetCustomFieldValues,
} from "@/lib/shift-custom-fields";

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
    const hasAccess = await hasCapability(user?.id, calendarId, "viewShifts");
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
    const withSegs = calendar.splitShiftsEnabled
      ? await withPresetSegments(presets)
      : presets;
    const definitions = await getCalendarCustomFields(calendarId);
    return NextResponse.json(await withPresetCustomFields(withSegs, definitions));
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
      groupName,
      isSecondary,
      isAllDay,
      hideFromStats,
      defaultSignupCapacity,
      segments: requestedSegments,
      customFields,
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

    // Check create permission (works for both authenticated users and guests)
    const hasAccess = await hasCapability(user?.id, calendarId, "createPreset");
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

    const rawSegments: TimeRange[] = isAllDay || !Array.isArray(requestedSegments)
      ? []
      : requestedSegments;
    if (rawSegments.length > 0 && !calendar.splitShiftsEnabled) {
      return NextResponse.json(
        { error: "Split shifts are not enabled for this calendar" },
        { status: 400 }
      );
    }
    let effectiveStartTime = startTime;
    let effectiveEndTime = endTime;
    let segmentsToPersist = rawSegments;
    if (!isAllDay) {
      const allRanges = toTimeRanges({ startTime, endTime, segments: rawSegments });
      const validationError = validateTimeRanges(allRanges);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      // Persisted primary is always the chronologically earliest range.
      const normalized = normalizeTimeRanges(allRanges);
      effectiveStartTime = normalized.startTime;
      effectiveEndTime = normalized.endTime;
      segmentsToPersist = normalized.segments;
    }

    const customFieldDefinitions = await getCalendarCustomFields(calendarId);
    const resolvedCustomFields = resolveCustomFieldValues(
      customFieldDefinitions,
      customFields
    );
    if ("error" in resolvedCustomFields) {
      return NextResponse.json({ error: resolvedCustomFields.error }, { status: 400 });
    }

    const preset = db.transaction((tx) => {
      const inserted = tx
        .insert(shiftPresets)
        .values({
          calendarId,
          title,
          startTime: isAllDay ? "00:00" : effectiveStartTime,
          endTime: isAllDay ? "23:59" : effectiveEndTime,
          color: color || "#3b82f6",
          notes: notes || null,
          groupName: groupName ? trimOrNull(groupName) : null,
          isSecondary: isSecondary || false,
          isAllDay: isAllDay || false,
          hideFromStats: hideFromStats || false,
          defaultSignupCapacity:
            typeof defaultSignupCapacity === "number"
              ? defaultSignupCapacity
              : null,
          order: maxOrder + 1,
          createdBy: user?.id ?? null,
        })
        .returning()
        .get();
      replacePresetSegments(tx, inserted.id, segmentsToPersist);
      replacePresetCustomFieldValues(tx, inserted.id, resolvedCustomFields.values);
      return inserted;
    });

    const [withFields] = await withPresetCustomFields([preset], customFieldDefinitions);
    return NextResponse.json({ ...withFields, segments: segmentsToPersist });
  } catch (error) {
    console.error("Error creating preset:", error);
    return NextResponse.json(
      { error: "Failed to create preset" },
      { status: 500 }
    );
  }
}
