import { differenceInCalendarDays } from "date-fns";
import { CalendarNote } from "./db/schema";
import { toLocalDate } from "./date-utils";

export function matchesRecurringEvent(
  eventDate: Date,
  targetDate: Date,
  recurringPattern?: string | null,
  recurringInterval?: number | null
): boolean {
  if (!recurringPattern || recurringPattern === "none") {
    return false;
  }

  const eventMonth = eventDate.getMonth();
  const eventDay = eventDate.getDate();
  const eventDayOfWeek = eventDate.getDay();
  const eventYear = eventDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();
  const targetDayOfWeek = targetDate.getDay();
  const targetYear = targetDate.getFullYear();

  switch (recurringPattern) {
    case "custom-weeks": {
      // Custom weekly interval (e.g., every 2 weeks)
      if (!recurringInterval || recurringInterval <= 0) return false;
      if (eventDayOfWeek !== targetDayOfWeek) return false;
      if (targetDate < eventDate) return false;

      // Calendar days, not elapsed ms: a DST switch makes one day 23 or 25 hours long
      const daysDiff = differenceInCalendarDays(targetDate, eventDate);
      return daysDiff % (7 * recurringInterval) === 0;
    }

    case "custom-months": {
      // Custom monthly interval (e.g., every 3 months)
      if (!recurringInterval || recurringInterval <= 0) return false;
      if (targetDate < eventDate) return false;

      // Calculate total months from a common reference point to handle year boundaries
      const eventTotalMonths = eventYear * 12 + eventMonth;
      const targetTotalMonths = targetYear * 12 + targetMonth;
      const monthsDiff = targetTotalMonths - eventTotalMonths;

      // Check if the month interval matches
      if (monthsDiff % recurringInterval !== 0) return false;

      // Handle day matching with edge case for months with fewer days
      // E.g., event on Jan 31 should match Feb 28/29, Apr 30, etc.
      const lastDayOfTargetMonth = new Date(
        targetYear,
        targetMonth + 1,
        0
      ).getDate();
      const expectedDay = Math.min(eventDay, lastDayOfTargetMonth);

      return targetDay === expectedDay;
    }

    default:
      return false;
  }
}

// Find all notes for a specific date (both notes and events, including recurring)
export function findNotesForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote[] {
  return notes.filter((note) => {
    if (!note.date) return false;
    const noteDate = toLocalDate(note.date);

    // Exact date match
    if (
      noteDate.getFullYear() === date.getFullYear() &&
      noteDate.getMonth() === date.getMonth() &&
      noteDate.getDate() === date.getDate()
    ) {
      return true;
    }

    // Recurring match (only for events)
    if (note.type === "event") {
      return matchesRecurringEvent(
        noteDate,
        date,
        note.recurringPattern,
        note.recurringInterval
      );
    }

    return false;
  });
}
