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
      if (eventDay !== targetDay) return false;
      if (targetDate < eventDate) return false;

      // Calculate total months from a common reference point to handle year boundaries
      const eventTotalMonths = eventYear * 12 + eventMonth;
      const targetTotalMonths = targetYear * 12 + targetMonth;
      const monthsDiff = targetTotalMonths - eventTotalMonths;

      return monthsDiff % recurringInterval === 0;
    }

    default:
      return false;
  }
}

export function findEventForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote | undefined {
  return notes.find((note) => {
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

export function findNoteForDate(
  notes: CalendarNote[],
  date: Date
): CalendarNote | undefined {
  return notes.find((note) => {
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
