import { CalendarNote } from "./db/schema";

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

      // Normalize dates to midnight to avoid time component issues
      const eventMidnight = new Date(eventDate);
      eventMidnight.setHours(0, 0, 0, 0);
      const targetMidnight = new Date(targetDate);
      targetMidnight.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (targetMidnight.getTime() - eventMidnight.getTime()) /
          (1000 * 60 * 60 * 24)
      );
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

// Find all events for a specific date (including recurring)
export function findEventsForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote[] {
  return notes.filter((note) => {
    if (note.type !== "event" || !note.date) return false;
    const noteDate = new Date(note.date);

    // Exact date match
    if (
      noteDate.getFullYear() === date.getFullYear() &&
      noteDate.getMonth() === date.getMonth() &&
      noteDate.getDate() === date.getDate()
    ) {
      return true;
    }

    // Recurring match
    return matchesRecurringEvent(
      noteDate,
      date,
      note.recurringPattern,
      note.recurringInterval
    );
  });
}

// Find all notes for a specific date (both notes and events, including recurring)
export function findNotesForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote[] {
  return notes.filter((note) => {
    if (!note.date) return false;
    const noteDate = new Date(note.date);

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

// Legacy functions for backwards compatibility - return first match
export function findEventForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote | undefined {
  return findEventsForDate(notes, date)[0];
}

export function findNoteForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote | undefined {
  return findNotesForDate(notes, date)[0];
}
