import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shiftPresets, shifts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability, hasOwnedCapability } from "@/lib/auth/permissions";
import { parseLocalDate } from "@/lib/date-utils";
import { replaceShiftSegments, withShiftSegments } from "@/lib/shift-time-ranges";
import { normalizeTimeRanges, toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";
import {
  getCalendarCustomFields,
  withShiftCustomFields,
  resolveCustomFieldValues,
  replaceShiftCustomFieldValues,
  type CustomFieldValueRow,
} from "@/lib/shift-custom-fields";

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
        signupCapacity: shifts.signupCapacity,
        createdAt: shifts.createdAt,
        updatedAt: shifts.updatedAt,
        calendar: {
          id: calendars.id,
          name: calendars.name,
          color: calendars.color,
          splitShiftsEnabled: calendars.splitShiftsEnabled,
        },
      })
      .from(shifts)
      .leftJoin(calendars, eq(shifts.calendarId, calendars.id))
      .where(eq(shifts.id, id));

    if (!result[0]) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await hasCapability(
      user?.id,
      result[0].calendarId,
      "viewShifts"
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    if (!result[0].calendar?.splitShiftsEnabled) {
      return NextResponse.json(result[0]);
    }
    const [withSegments] = await withShiftSegments([result[0]]);
    return NextResponse.json(withSegments);
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
    const hasAccess = await hasOwnedCapability(
      user?.id,
      shift.calendarId,
      "deleteOwnShift",
      "deleteAnyShift",
      shift.createdBy
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

    // Check if shift is externally synced (read-only)
    if (shift.externalSyncId || shift.syncedFromExternal) {
      return NextResponse.json(
        { error: "Cannot delete externally synced shifts. They are read-only." },
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

    // Check write permission (works for both authenticated users and guests)
    const hasAccess = await hasOwnedCapability(
      user?.id,
      existingShift.calendarId,
      "editOwnShift",
      "editAnyShift",
      existingShift.createdBy
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

    // Check if shift is externally synced (read-only)
    if (existingShift.externalSyncId || existingShift.syncedFromExternal) {
      return NextResponse.json(
        { error: "Cannot edit externally synced shifts. They are read-only." },
        { status: 403 }
      );
    }

    let date = existingShift.date;
    if (body.date) {
      try {
        date = parseLocalDate(body.date);
      } catch {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
    }

    // A client-submitted presetId must belong to the shift's own calendar,
    // otherwise a shift could get silently linked to another calendar's preset.
    if (body.presetId && body.presetId !== existingShift.presetId) {
      const [preset] = await db
        .select()
        .from(shiftPresets)
        .where(
          and(
            eq(shiftPresets.id, body.presetId),
            eq(shiftPresets.calendarId, existingShift.calendarId)
          )
        );
      if (!preset) {
        return NextResponse.json(
          { error: "Preset not found" },
          { status: 404 }
        );
      }
    }

    let nextStartTime = body.startTime ?? existingShift.startTime;
    let nextEndTime = body.endTime ?? existingShift.endTime;
    const nextIsAllDay = body.isAllDay ?? existingShift.isAllDay;

    // Segments are only ever written when the calendar has split shifts enabled — otherwise
    // a client that can no longer see stored segments (GET omits them while the flag is off)
    // would round-trip `segments: []` on any unrelated edit and wipe the real stored rows.
    let nextSegments: TimeRange[] | undefined;
    if (body.segments !== undefined) {
      const rawSegments: TimeRange[] = Array.isArray(body.segments) ? body.segments : [];
      const [calendar] = await db
        .select()
        .from(calendars)
        .where(eq(calendars.id, existingShift.calendarId));
      if (!nextIsAllDay) {
        if (rawSegments.length > 0 && !calendar?.splitShiftsEnabled) {
          return NextResponse.json(
            { error: "Split shifts are not enabled for this calendar" },
            { status: 400 }
          );
        }
        const allRanges = toTimeRanges({
          startTime: nextStartTime,
          endTime: nextEndTime,
          segments: rawSegments,
        });
        const validationError = validateTimeRanges(allRanges);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
        if (calendar?.splitShiftsEnabled) {
          // Persisted primary is always the chronologically earliest range.
          const normalized = normalizeTimeRanges(allRanges);
          nextStartTime = normalized.startTime;
          nextEndTime = normalized.endTime;
          nextSegments = normalized.segments;
        }
      } else if (calendar?.splitShiftsEnabled) {
        nextSegments = [];
      }
    }

    const customFieldDefinitions = await getCalendarCustomFields(existingShift.calendarId);
    // null means "not mentioned in the request" — leave existing values untouched;
    // an empty object still resolves to [] and clears them.
    let customFieldValuesToPersist: CustomFieldValueRow[] | null = null;
    if (body.customFields !== undefined) {
      const resolved = resolveCustomFieldValues(customFieldDefinitions, body.customFields);
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      customFieldValuesToPersist = resolved.values;
    }

    // Update the shift
    const updatedShift = db.transaction((tx) => {
      const updated = tx
        .update(shifts)
        .set({
          date,
          startTime: nextStartTime,
          endTime: nextEndTime,
          title: body.title ?? existingShift.title,
          color: body.color ?? existingShift.color,
          notes: body.notes ?? existingShift.notes,
          isAllDay: nextIsAllDay,
          presetId: body.presetId ?? existingShift.presetId,
          signupCapacity:
            typeof body.signupCapacity === "number"
              ? body.signupCapacity
              : body.signupCapacity === null
                ? null
                : existingShift.signupCapacity,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, id))
        .returning()
        .get();
      if (nextSegments !== undefined) {
        replaceShiftSegments(tx, id, nextSegments);
      }
      if (customFieldValuesToPersist !== null) {
        replaceShiftCustomFieldValues(tx, id, customFieldValuesToPersist);
      }
      return updated;
    });

    const [withSegments] = await withShiftSegments([updatedShift]);
    const [withCustomFields] = await withShiftCustomFields([withSegments], customFieldDefinitions);
    return NextResponse.json(withCustomFields);
  } catch (error) {
    console.error("Failed to update shift:", error);
    return NextResponse.json(
      { error: "Failed to update shift" },
      { status: 500 }
    );
  }
}
