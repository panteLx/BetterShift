import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts, shiftPresets, externalSyncs } from "@/lib/db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability, getCalendarAccess } from "@/lib/auth/permissions";
import { addShiftSignup, withSignups } from "@/lib/shift-signups";
import { parseLocalDate } from "@/lib/date-utils";
import type { CalendarMember } from "@/lib/types";
import { withShiftSegments, replaceShiftSegments, withPresetSegments } from "@/lib/shift-time-ranges";
import { toTimeRanges, validateTimeRanges, type TimeRange } from "@/lib/time-ranges";

// GET shifts for a calendar (with optional date filter)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");
    const date = searchParams.get("date");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
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

    const query = db
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
        syncedFromExternal: shifts.syncedFromExternal,
        externalSyncId: shifts.externalSyncId,
        createdBy: shifts.createdBy,
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
      .leftJoin(externalSyncs, eq(shifts.externalSyncId, externalSyncs.id));

    if (date) {
      let targetDate;
      try {
        targetDate = parseLocalDate(date);
      } catch {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        );
      }
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await query.where(
        and(
          eq(shifts.calendarId, calendarId),
          gte(shifts.date, startOfDay),
          lte(shifts.date, endOfDay),
          // Exclude shifts from hidden external syncs (or shifts that are not synced)
          or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
        )
      );
      const withSigs = await withSignups(result);
      return NextResponse.json(
        calendar.splitShiftsEnabled ? await withShiftSegments(withSigs) : withSigs
      );
    }

    const result = await query.where(
      and(
        eq(shifts.calendarId, calendarId),
        // Exclude shifts from hidden external syncs (or shifts that are not synced)
        or(isNull(shifts.externalSyncId), eq(externalSyncs.isHidden, false))
      )
    );
    const withSigs = await withSignups(result);
    return NextResponse.json(
      calendar.splitShiftsEnabled ? await withShiftSegments(withSigs) : withSigs
    );
  } catch (error) {
    console.error("Failed to fetch shifts:", error);
    return NextResponse.json(
      { error: "Failed to fetch shifts" },
      { status: 500 }
    );
  }
}

// POST create new shift (requires write permission)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
      date,
      startTime,
      endTime,
      title,
      color,
      notes,
      presetId,
      isAllDay,
      isSecondary,
      signupCapacity,
      signupUserIds,
      segments: requestedSegments,
    } = body;

    if (!calendarId || !date || !title) {
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

    // A caller needs at least one of the two shift-creation capabilities.
    const access = await getCalendarAccess(user?.id, calendarId);
    if (
      !access ||
      !(access.can("stampPreset") || access.can("createShift"))
    ) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

    let parsedDate;
    try {
      parsedDate = parseLocalDate(date);
    } catch {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // A caller with only stampPreset (no createShift) can only stamp an
    // existing preset as-is — pull title/time/color/notes/isAllDay from the
    // preset record itself instead of trusting client-submitted overrides,
    // otherwise "presets only" is trivially bypassed by sending presetId
    // alongside arbitrary fields.
    let insertValues: {
      title: string;
      startTime: string;
      endTime: string;
      color: string;
      notes: string | null;
      isAllDay: boolean;
    };
    let segmentsToPersist: TimeRange[] = [];
    if (access.can("createShift")) {
      if (presetId) {
        const [preset] = await db
          .select()
          .from(shiftPresets)
          .where(
            and(
              eq(shiftPresets.id, presetId),
              eq(shiftPresets.calendarId, calendarId)
            )
          );
        if (!preset) {
          return NextResponse.json(
            { error: "Preset not found" },
            { status: 404 }
          );
        }
      }
      insertValues = {
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color: color || "#3b82f6",
        notes: notes || null,
        isAllDay: isAllDay || false,
      };

      if (!isAllDay) {
        const rawSegments: TimeRange[] = Array.isArray(requestedSegments)
          ? requestedSegments
          : [];
        if (rawSegments.length > 0 && !calendar.splitShiftsEnabled) {
          return NextResponse.json(
            { error: "Split shifts are not enabled for this calendar" },
            { status: 400 }
          );
        }
        const allRanges = toTimeRanges({ ...insertValues, segments: rawSegments });
        const validationError = validateTimeRanges(allRanges);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
        segmentsToPersist = rawSegments;
      }
    } else {
      if (!presetId) {
        return NextResponse.json(
          { error: "presetId is required" },
          { status: 400 }
        );
      }
      const [preset] = await db
        .select()
        .from(shiftPresets)
        .where(
          and(
            eq(shiftPresets.id, presetId),
            eq(shiftPresets.calendarId, calendarId)
          )
        );
      if (!preset) {
        return NextResponse.json(
          { error: "Preset not found" },
          { status: 404 }
        );
      }
      insertValues = {
        title: preset.title,
        startTime: preset.isAllDay ? "00:00" : preset.startTime,
        endTime: preset.isAllDay ? "23:59" : preset.endTime,
        color: preset.color,
        notes: preset.notes,
        isAllDay: preset.isAllDay,
      };
      if (!preset.isAllDay && calendar.splitShiftsEnabled) {
        const [presetWithSegments] = await withPresetSegments([preset]);
        segmentsToPersist = presetWithSegments.segments;
      }
    }

    const shift = db.transaction((tx) => {
      const inserted = tx
        .insert(shifts)
        .values({
          calendarId,
          presetId: presetId || null,
          date: parsedDate,
          ...insertValues,
          isSecondary: isSecondary || false,
          signupCapacity:
            typeof signupCapacity === "number" ? signupCapacity : null,
          createdBy: user?.id ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
        .get();
      replaceShiftSegments(tx, inserted.id, segmentsToPersist);
      return inserted;
    });

    // Best-effort: a shift the caller picked people for still gets created
    // even if one of those signups is no longer valid by the time we get here.
    let signups: CalendarMember[] = [];
    if (user && Array.isArray(signupUserIds) && signupUserIds.length > 0) {
      const existingIds = new Set<string>();
      const capacity = typeof signupCapacity === "number" ? signupCapacity : null;
      for (const targetUserId of signupUserIds) {
        if (typeof targetUserId !== "string") continue;
        await addShiftSignup(
          shift.id,
          calendarId,
          user.id,
          targetUserId,
          existingIds,
          capacity
        );
      }
      if (existingIds.size > 0) {
        [{ signups }] = await withSignups([shift]);
      }
    }

    return NextResponse.json(
      { ...shift, calendar, signups, segments: segmentsToPersist },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create shift:", error);
    return NextResponse.json(
      { error: "Failed to create shift" },
      { status: 500 }
    );
  }
}
