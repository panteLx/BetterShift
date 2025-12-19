// Re-export types from Drizzle schema
export type { Calendar, Shift, ExternalSync } from "./db/schema";

export interface CalendarWithCount {
  id: string;
  name: string;
  color: string;
  passwordHash?: string | null;
  isLocked?: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  _count?: number;
}

export interface ShiftWithCalendar {
  id: string;
  calendarId: string;
  presetId?: string | null;
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
  syncedFromExternal?: boolean;
  externalSyncId?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}
