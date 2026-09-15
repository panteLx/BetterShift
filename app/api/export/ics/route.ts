import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import ICAL from "ical.js";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { getServerTimezone, formatDateToLocal } from "@/lib/date-utils";
import { rateLimit } from "@/lib/rate-limiter";
import { toTimeRanges } from "@/lib/time-ranges";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);

    // Rate limiting: 20 ICS exports per 10 minutes
    const rateLimitResponse = rateLimit(request, user?.id, "export-ics");
    if (rateLimitResponse) return rateLimitResponse;

    const { calendarIds } = await request.json();

    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json(
        { error: "No calendar IDs provided" },
        { status: 400 }
      );
    }

    // Get all requested calendars
    const requestedCalendars = await db.query.calendars.findMany({
      where: inArray(calendars.id, calendarIds),
    });

    if (requestedCalendars.length === 0) {
      return NextResponse.json(
        { error: "No calendars found" },
        { status: 404 }
      );
    }

    // Filter calendars by permission - only include calendars user can view
    const accessFlags = await Promise.all(
      requestedCalendars.map((calendar) =>
        hasCapability(user?.id, calendar.id, "viewShifts")
      )
    );
    const accessibleCalendars = requestedCalendars.filter(
      (_, i) => accessFlags[i]
    );

    if (accessibleCalendars.length === 0) {
      return NextResponse.json(
        { error: "Insufficient permissions for selected calendars" },
        { status: 403 }
      );
    }

    // Get all shifts for accessible calendars
    let allShifts = await db.query.shifts.findMany({
      where: inArray(
        shifts.calendarId,
        accessibleCalendars.map((c) => c.id)
      ),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
      with: { segments: true },
    });

    // A calendar that has since turned split shifts off must fall back to
    // showing only its shifts' primary ranges, without deleting the stored segments.
    const splitShiftsEnabledIds = new Set(
      accessibleCalendars.filter((c) => c.splitShiftsEnabled).map((c) => c.id)
    );
    allShifts = allShifts.map((shift) =>
      splitShiftsEnabledIds.has(shift.calendarId) ? shift : { ...shift, segments: [] }
    );

    // Create calendar name lookup
    const calendarMap = new Map(accessibleCalendars.map((c) => [c.id, c.name]));

    // Get server timezone for proper time conversion
    const serverTimezone = getServerTimezone();

    // Determine if multi-calendar export
    const isMultiCalendar = accessibleCalendars.length > 1;

    // Create iCalendar
    const cal = new ICAL.Component(["vcalendar", [], []]);
    cal.updatePropertyWithValue(
      "prodid",
      "-//BetterShift//Calendar Export//EN"
    );
    cal.updatePropertyWithValue("version", "2.0");
    cal.updatePropertyWithValue("calscale", "GREGORIAN");
    cal.updatePropertyWithValue("method", "PUBLISH");
    cal.updatePropertyWithValue(
      "x-wr-calname",
      isMultiCalendar
        ? "BetterShift Multi-Calendar"
        : accessibleCalendars[0].name
    );
    cal.updatePropertyWithValue("x-wr-timezone", serverTimezone);

    // Add shifts as events
    for (const shift of allShifts) {
      const shiftDate = shift.date as Date;
      const calendarName = calendarMap.get(shift.calendarId);
      const summary = isMultiCalendar
        ? `[${calendarName}] ${shift.title}`
        : shift.title;

      const ranges = shift.isAllDay ? [null] : toTimeRanges(shift);

      ranges.forEach((range, index) => {
        const vevent = new ICAL.Component("vevent");
        const event = new ICAL.Event(vevent);

        event.uid = index === 0 ? shift.id : `${shift.id}-seg-${index}`;
        event.summary = summary;
        if (shift.notes) {
          event.description = shift.notes;
        }

        if (!range) {
          // All-day event (DTEND is exclusive per RFC 5545)
          const dateStr = formatDateToLocal(shiftDate);
          event.startDate = ICAL.Time.fromDateString(dateStr);

          const endDate = new Date(shiftDate);
          endDate.setDate(endDate.getDate() + 1);
          const endYear = endDate.getFullYear();
          const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
          const endDay = String(endDate.getDate()).padStart(2, "0");
          event.endDate = ICAL.Time.fromDateString(`${endYear}-${endMonth}-${endDay}`);
        } else {
          const [startHour, startMinute] = range.startTime.split(":").map(Number);
          const [endHour, endMinute] = range.endTime.split(":").map(Number);

          const startDateTime = new Date(shiftDate);
          startDateTime.setHours(startHour, startMinute, 0, 0);

          const endDateTime = new Date(shiftDate);
          endDateTime.setHours(endHour, endMinute, 0, 0);

          if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
          }

          event.startDate = ICAL.Time.fromJSDate(startDateTime, true);
          event.endDate = ICAL.Time.fromJSDate(endDateTime, true);
        }

        vevent.addPropertyWithValue("color", shift.color);
        vevent.addPropertyWithValue("x-apple-calendar-color", shift.color);

        cal.addSubcomponent(vevent);
      });
    }

    // Generate ICS content
    const icsContent = cal.toString();

    // Create filename from calendar names (truncated)
    const calendarNamesParts = accessibleCalendars
      .map((c) =>
        c.name
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()
          .substring(0, 20)
      )
      .slice(0, 3); // Max 3 calendar names

    const filename = `${calendarNamesParts.join("_")}_${
      formatDateToLocal(new Date())
    }.ics`;

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendars as ICS:", error);
    return NextResponse.json(
      { error: "Failed to export calendars" },
      { status: 500 }
    );
  }
}
