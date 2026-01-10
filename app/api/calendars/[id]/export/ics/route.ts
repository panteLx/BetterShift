import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ICAL from "ical.js";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar } from "@/lib/auth/permissions";
import { getServerTimezone, formatDateToLocal } from "@/lib/date-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    // Get calendar
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, id),
    });

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get all shifts for this calendar
    const calendarShifts = await db.query.shifts.findMany({
      where: eq(shifts.calendarId, id),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
    });

    // Get server timezone for proper time conversion
    const serverTimezone = getServerTimezone();

    // Create iCalendar
    const cal = new ICAL.Component(["vcalendar", [], []]);
    cal.updatePropertyWithValue(
      "prodid",
      "-//BetterShift//Calendar Export//EN"
    );
    cal.updatePropertyWithValue("version", "2.0");
    cal.updatePropertyWithValue("calscale", "GREGORIAN");
    cal.updatePropertyWithValue("method", "PUBLISH");
    cal.updatePropertyWithValue("x-wr-calname", calendar.name);
    cal.updatePropertyWithValue("x-wr-timezone", serverTimezone);

    // Add shifts as events
    for (const shift of calendarShifts) {
      const vevent = new ICAL.Component("vevent");
      const event = new ICAL.Event(vevent);

      // Set event ID
      event.uid = shift.id;

      // Set title
      event.summary = shift.title;

      // Set description (notes)
      if (shift.notes) {
        event.description = shift.notes;
      }

      // Set times
      // shift.date is already a Date object from Drizzle (mode: "timestamp")
      const shiftDate = shift.date as Date;

      if (shift.isAllDay) {
        // All-day event (DTEND is exclusive per RFC 5545)
        // Use formatDateToLocal to get YYYY-MM-DD format
        const dateStr = formatDateToLocal(shiftDate);

        const startTime = ICAL.Time.fromDateString(dateStr);
        event.startDate = startTime;

        // DTEND must be the day after DTSTART for single-day all-day events
        const endDate = new Date(shiftDate);
        endDate.setDate(endDate.getDate() + 1);
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
        const endDay = String(endDate.getDate()).padStart(2, "0");
        const endDateStr = `${endYear}-${endMonth}-${endDay}`;

        event.endDate = ICAL.Time.fromDateString(endDateStr);
      } else {
        // Timed event
        const [startHour, startMinute] = shift.startTime.split(":").map(Number);
        const [endHour, endMinute] = shift.endTime.split(":").map(Number);

        // Create date objects in server timezone
        const startDateTime = new Date(shiftDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(shiftDate);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Handle shifts that end after midnight
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        // Convert to UTC for iCalendar standard compliance
        // JavaScript Date objects are timezone-aware and will be correctly converted
        const startIcalTime = ICAL.Time.fromJSDate(startDateTime, true);
        const endIcalTime = ICAL.Time.fromJSDate(endDateTime, true);

        event.startDate = startIcalTime;
        event.endDate = endIcalTime;
      }

      // Set color (using X-APPLE-CALENDAR-COLOR for Apple Calendar compatibility)
      vevent.addPropertyWithValue("color", shift.color);
      vevent.addPropertyWithValue("x-apple-calendar-color", shift.color);

      // Add event to calendar
      cal.addSubcomponent(vevent);
    }

    // Generate ICS content
    const icsContent = cal.toString();

    // Return as downloadable file
    const filename = `${calendar.name
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()}_${new Date().toISOString().split("T")[0]}.ics`;

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendar as ICS:", error);
    return NextResponse.json(
      { error: "Failed to export calendar" },
      { status: 500 }
    );
  }
}
