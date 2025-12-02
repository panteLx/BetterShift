/**
 * iCloud calendar utility functions
 */

import ICAL from "ical.js";

/**
 * Validates iCloud calendar URL to prevent SSRF vulnerabilities
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidICloudUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check if protocol is webcal or https
    if (!["webcal:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    // Check if hostname is from iCloud domain
    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname.endsWith(".icloud.com") && hostname !== "icloud.com") {
      return false;
    }

    return true;
  } catch {
    // Invalid URL format
    return false;
  }
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

  // Normalize dates to midnight for comparison
  const startDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
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

      const endHours = endDate.getHours().toString().padStart(2, "0");
      const endMinutes = endDate.getMinutes().toString().padStart(2, "0");
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
          const endHours = endDate.getHours().toString().padStart(2, "0");
          const endMinutes = endDate.getMinutes().toString().padStart(2, "0");
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
