import ICAL from "ical.js";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { shifts, type Calendar } from "@/lib/db/schema";
import { getServerTimezone, formatDateToLocal } from "@/lib/date-utils";
import { toTimeRanges } from "@/lib/time-ranges";
import { getCalendarCustomFields, withShiftCustomFields } from "@/lib/shift-custom-fields";
import { formatValueForDisplay } from "@/lib/custom-fields";

export type IcsCalendar = Pick<Calendar, "id" | "name" | "splitShiftsEnabled">;

export async function buildIcsCalendar({
  calendars,
  locale,
  feed = false,
}: {
  calendars: IcsCalendar[];
  locale: string;
  feed?: boolean;
}): Promise<string> {
  // Get all shifts for accessible calendars
  let allShifts = await db.query.shifts.findMany({
    where: inArray(
      shifts.calendarId,
      calendars.map((c) => c.id)
    ),
    orderBy: (shifts, { asc }) => [asc(shifts.date)],
    with: { segments: true },
  });

  // A calendar that has since turned split shifts off must fall back to
  // showing only its shifts' primary ranges, without deleting the stored segments.
  const splitShiftsEnabledIds = new Set(
    calendars.filter((c) => c.splitShiftsEnabled).map((c) => c.id)
  );
  allShifts = allShifts.map((shift) =>
    splitShiftsEnabledIds.has(shift.calendarId) ? shift : { ...shift, segments: [] }
  );

  // Create calendar name lookup
  const calendarMap = new Map(calendars.map((c) => [c.id, c.name]));

  // Field keys are per calendar, so definitions and values must be resolved calendar by calendar.
  const definitionsByCalendar = new Map(
    await Promise.all(
      calendars.map(
        async (c) => [c.id, await getCalendarCustomFields(c.id)] as const
      )
    )
  );
  const customFieldsByShiftId = new Map<string, Record<string, string | number | boolean | null>>();
  for (const c of calendars) {
    const definitions = definitionsByCalendar.get(c.id) ?? [];
    const calendarShifts = allShifts.filter((s) => s.calendarId === c.id);
    const withFields = await withShiftCustomFields(calendarShifts, definitions);
    for (const s of withFields) {
      customFieldsByShiftId.set(s.id, s.customFields);
    }
  }

  // Get server timezone for proper time conversion
  const serverTimezone = getServerTimezone();

  // Determine if multi-calendar export
  const isMultiCalendar = calendars.length > 1;

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
      : calendars[0].name
  );
  cal.updatePropertyWithValue("x-wr-timezone", serverTimezone);

  if (feed) {
    // Hints only; clients poll on their own schedule (Google: several hours).
    cal.updatePropertyWithValue("refresh-interval", ICAL.Duration.fromString("PT1H"));
    cal.updatePropertyWithValue("x-published-ttl", "PT1H");
  }

  // Add shifts as events
  for (const shift of allShifts) {
    const shiftDate = shift.date as Date;
    const calendarName = calendarMap.get(shift.calendarId);
    const summary = isMultiCalendar
      ? `[${calendarName}] ${shift.title}`
      : shift.title;

    const ranges = shift.isAllDay ? [null] : toTimeRanges(shift);

    const definitions = definitionsByCalendar.get(shift.calendarId) ?? [];
    const customFields = customFieldsByShiftId.get(shift.id) ?? {};
    const fieldLines = definitions
      .map((d) => {
        const raw = customFields[d.key];
        if (raw === null || raw === undefined || raw === "") return null;
        return `${d.label}: ${formatValueForDisplay(d, String(raw), locale)}`;
      })
      .filter((line): line is string => line !== null);
    const description = [shift.notes, ...fieldLines].filter(Boolean).join("\n");

    ranges.forEach((range, index) => {
      const vevent = new ICAL.Component("vevent");
      const event = new ICAL.Event(vevent);

      event.uid = index === 0 ? shift.id : `${shift.id}-seg-${index}`;
      event.summary = summary;
      if (description) {
        event.description = description;
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

  return cal.toString();
}
