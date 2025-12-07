/**
 * External calendar utility functions
 * Supports iCloud, Google Calendar, and other iCal-based calendar services
 */

import ICAL from "ical.js";

export type CalendarSyncType = "icloud" | "google" | "custom";

/**
 * Detects the calendar sync type based on the URL
 * @param url - The calendar URL
 * @returns The detected sync type (icloud, google, or custom)
 */
export function detectCalendarSyncType(url: string): CalendarSyncType {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check for iCloud domain
    if (hostname.endsWith(".icloud.com") || hostname === "icloud.com") {
      return "icloud";
    }

    // Check for Google domain
    if (
      hostname.endsWith(".google.com") ||
      hostname === "google.com" ||
      hostname === "calendar.google.com"
    ) {
      return "google";
    }

    // Everything else is custom
    return "custom";
  } catch {
    // Invalid URL, default to custom
    return "custom";
  }
}

/**
 * Validates external calendar URL to prevent SSRF vulnerabilities
 * @param url - The URL to validate
 * @param syncType - The type of calendar sync (icloud, google, or custom)
 * @returns true if valid, false otherwise
 */
export function isValidCalendarUrl(
  url: string,
  syncType: CalendarSyncType
): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check if protocol is webcal or https
    if (!["webcal:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Validate based on sync type
    if (syncType === "icloud") {
      // Check if hostname is from iCloud domain
      if (!hostname.endsWith(".icloud.com") && hostname !== "icloud.com") {
        return false;
      }
    } else if (syncType === "google") {
      // Check if hostname is from Google Calendar domain
      if (
        !hostname.endsWith(".google.com") &&
        hostname !== "google.com" &&
        hostname !== "calendar.google.com"
      ) {
        return false;
      }
    } else if (syncType === "custom") {
      // For custom calendars, validate against SSRF
      // Block localhost, private IPs, and internal domains
      if (
        hostname === "localhost" ||
        hostname.match(/^127\./) ||
        hostname.match(/^10\./) ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./) ||
        hostname.match(/^192\.168\./) ||
        hostname.match(/^169\.254\./) ||
        hostname === "::1" ||
        hostname === "0.0.0.0"
      ) {
        return false;
      }

      return true;
    }

    return true;
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Validates ICS file content
 * @param icsContent - The ICS file content as string
 * @returns true if valid ICS format, false otherwise
 */
export function isValidICSContent(icsContent: string): boolean {
  try {
    const jcalData = ICAL.parse(icsContent);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");
    return vevents.length > 0;
  } catch {
    return false;
  }
}

/**
 * Backwards compatibility - validates iCloud URLs
 * @deprecated Use isValidCalendarUrl instead
 */
export function isValidICloudUrl(url: string): boolean {
  return isValidCalendarUrl(url, "icloud");
}

/**
 * Expands recurring events into individual occurrences within a time window
 * @param vevent - The VEVENT component from iCal.js
 * @param startWindow - Start of the time window (default: now)
 * @param endWindow - End of the time window (default: 1 year from now)
 * @returns Array of event occurrences with their dates
 */
export function expandRecurringEvents(
  vevent: ICAL.Component,
  startWindow?: Date,
  endWindow?: Date
): Array<{
  event: ICAL.Event;
  startDate: ICAL.Time;
  endDate: ICAL.Time;
  recurrenceId?: ICAL.Time;
}> {
  const event = new ICAL.Event(vevent);
  const occurrences: Array<{
    event: ICAL.Event;
    startDate: ICAL.Time;
    endDate: ICAL.Time;
    recurrenceId?: ICAL.Time;
  }> = [];

  // Default time window: now to 1 year from now
  const start = startWindow || new Date();
  const end = endWindow || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const startTime = ICAL.Time.fromJSDate(start, true);
  const endTime = ICAL.Time.fromJSDate(end, true);

  // Check if this event has a recurrence rule
  if (event.isRecurring()) {
    // Use the iterator to expand recurring events
    const iterator = event.iterator();
    let next;

    // Iterate through all occurrences within the time window
    while ((next = iterator.next())) {
      // Stop if we've gone past the end window
      if (next.compare(endTime) > 0) {
        break;
      }

      // Skip if before start window
      if (next.compare(startTime) < 0) {
        continue;
      }

      // Calculate the end time for this occurrence
      const duration = event.duration;
      const occurrenceEnd = next.clone();
      occurrenceEnd.addDuration(duration);

      occurrences.push({
        event,
        startDate: next,
        endDate: occurrenceEnd,
        recurrenceId: next,
      });
    }
  } else {
    // Non-recurring event - just return the single occurrence if it's within the window
    const eventStart = event.startDate;
    const eventEnd = event.endDate;

    if (
      eventStart &&
      eventEnd &&
      eventStart.compare(endTime) <= 0 &&
      eventEnd.compare(startTime) >= 0
    ) {
      occurrences.push({
        event,
        startDate: eventStart,
        endDate: eventEnd,
      });
    }
  }

  return occurrences;
}

/**
 * Splits a multi-day event into separate day entries
 * @param startDate - Start date/time of the event
 * @param endDate - End date/time of the event
 * @param isAllDay - Whether the event is an all-day event
 * @returns Array of day entries with date and time information
 */
export function splitMultiDayEvent(
  startDate: Date,
  endDate: Date,
  isAllDay: boolean
): Array<{
  date: Date;
  startTime: string;
  endTime: string;
  dayIndex: number;
}> {
  const days: Array<{
    date: Date;
    startTime: string;
    endTime: string;
    dayIndex: number;
  }> = [];

  // For all-day events, the end date in iCalendar format is exclusive
  // (e.g., a one-day event on Dec 1 has end date Dec 2 00:00)
  // We need to subtract one day for all-day events to get the actual last day
  let adjustedEndDate = endDate;
  if (isAllDay) {
    adjustedEndDate = new Date(endDate);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
  }

  // Normalize dates to midnight for comparison
  const startDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endDay = new Date(
    adjustedEndDate.getFullYear(),
    adjustedEndDate.getMonth(),
    adjustedEndDate.getDate()
  );

  // Check if event spans multiple days
  const daysDiff = Math.floor(
    (endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff === 0) {
    // Single day event
    let startTime = "00:00";
    let endTime = "23:59";

    if (!isAllDay) {
      const startHours = startDate.getHours().toString().padStart(2, "0");
      const startMinutes = startDate.getMinutes().toString().padStart(2, "0");
      startTime = `${startHours}:${startMinutes}`;

      const endHours = adjustedEndDate.getHours().toString().padStart(2, "0");
      const endMinutes = adjustedEndDate
        .getMinutes()
        .toString()
        .padStart(2, "0");
      endTime = `${endHours}:${endMinutes}`;
    }

    days.push({
      date: new Date(startDay),
      startTime,
      endTime,
      dayIndex: 0,
    });
  } else {
    // Multi-day event - split into separate days
    for (let i = 0; i <= daysDiff; i++) {
      const currentDay = new Date(startDay);
      currentDay.setDate(startDay.getDate() + i);

      let startTime = "00:00";
      let endTime = "23:59";

      if (!isAllDay) {
        if (i === 0) {
          // First day: use actual start time, end at midnight
          const startHours = startDate.getHours().toString().padStart(2, "0");
          const startMinutes = startDate
            .getMinutes()
            .toString()
            .padStart(2, "0");
          startTime = `${startHours}:${startMinutes}`;
          endTime = "23:59";
        } else if (i === daysDiff) {
          // Last day: start at midnight, use actual end time
          startTime = "00:00";
          const endHours = adjustedEndDate
            .getHours()
            .toString()
            .padStart(2, "0");
          const endMinutes = adjustedEndDate
            .getMinutes()
            .toString()
            .padStart(2, "0");
          endTime = `${endHours}:${endMinutes}`;
        }
        // Middle days keep default 00:00 - 23:59
      }

      days.push({
        date: new Date(currentDay),
        startTime,
        endTime,
        dayIndex: i,
      });
    }
  }

  return days;
}

/**
 * Creates a stable fingerprint for an event based on its content
 * This is used because some calendar providers generate new UIDs on each request
 * @param date - Event date
 * @param startTime - Start time
 * @param endTime - End time
 * @param title - Event title
 * @param dayIndex - For multi-day events, the day index
 * @returns A stable fingerprint string
 */
export function createEventFingerprint(
  date: Date,
  startTime: string,
  endTime: string,
  title: string,
  dayIndex?: number,
  externalEventId?: string
): string {
  const dateStr = new Date(date).toISOString().split("T")[0];
  const parts = [dateStr, startTime, endTime, title];
  if (dayIndex !== undefined) {
    parts.push(`day${dayIndex}`);
  }
  if (externalEventId) {
    parts.push(externalEventId);
  }
  return parts.join("|");
}

/**
 * Compares shift data to determine if an update is needed
 * @param existing - The existing shift from database
 * @param newData - The new shift data from external calendar
 * @returns true if shifts are different and update is needed
 */
export function needsUpdate(
  existing: {
    date: Date;
    startTime: string;
    endTime: string;
    title: string;
    color: string;
    notes: string | null;
    isAllDay: boolean;
    isSecondary: boolean;
  },
  newData: {
    date: Date;
    startTime: string;
    endTime: string;
    title: string;
    color: string;
    notes: string | null;
    isAllDay: boolean;
    isSecondary: boolean;
  }
): boolean {
  // Compare date (convert to comparable format)
  const existingDate = new Date(existing.date).toISOString().split("T")[0];
  const newDate = new Date(newData.date).toISOString().split("T")[0];
  if (existingDate !== newDate) return true;

  // Compare time fields
  if (existing.startTime !== newData.startTime) return true;
  if (existing.endTime !== newData.endTime) return true;

  // Compare title
  if (existing.title !== newData.title) return true;

  // Compare color
  if (existing.color !== newData.color) return true;

  // Compare notes (handle null values)
  if ((existing.notes || null) !== (newData.notes || null)) return true;

  // Compare boolean fields
  if (existing.isAllDay !== newData.isAllDay) return true;
  if (existing.isSecondary !== newData.isSecondary) return true;

  // No differences found
  return false;
}
