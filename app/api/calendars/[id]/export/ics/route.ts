import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
import ICAL from "ical.js";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

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

    // Check password protection
    if (calendar.passwordHash && calendar.isLocked) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // Get all shifts for this calendar
    const calendarShifts = await db.query.shifts.findMany({
      where: eq(shifts.calendarId, id),
      orderBy: (shifts, { asc }) => [asc(shifts.date)],
    });

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
    cal.updatePropertyWithValue("x-wr-timezone", "UTC");

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
      const shiftDate = new Date(shift.date);
      const dateStr = shiftDate.toISOString().split("T")[0]; // YYYY-MM-DD

      if (shift.isAllDay) {
        // All-day event
        const startTime = ICAL.Time.fromDateString(dateStr);
        event.startDate = startTime;
        event.endDate = startTime;
      } else {
        // Timed event
        const [startHour, startMinute] = shift.startTime.split(":").map(Number);
        const [endHour, endMinute] = shift.endTime.split(":").map(Number);

        const startDateTime = new Date(shiftDate);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(shiftDate);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // Handle shifts that end after midnight
        if (endDateTime <= startDateTime) {
          endDateTime.setDate(endDateTime.getDate() + 1);
        }

        event.startDate = ICAL.Time.fromJSDate(startDateTime, false);
        event.endDate = ICAL.Time.fromJSDate(endDateTime, false);
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
