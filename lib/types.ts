// Re-export types from Drizzle schema
export type { Calendar, Shift } from "./db/schema";

export interface CalendarWithCount {
  id: string;
  name: string;
  color: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  _count?: number;
}

export interface ShiftWithCalendar {
  id: string;
  calendarId: string;
  calendar?: {
    id: string;
    name: string;
    color: string;
  };
  date: Date | null;
  startTime: string;
  endTime: string;
  title: string;
  color: string;
  notes?: string | null;
  isAllDay?: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}
