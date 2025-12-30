// Re-export types from Drizzle schema
export type { Calendar, Shift, ExternalSync } from "./db/schema";

export interface CalendarWithCount {
  id: string;
  name: string;
  color: string;
  ownerId?: string | null;
  guestPermission?: "none" | "read" | "write";
  createdAt: Date | null;
  updatedAt: Date | null;
  _count?: number;
  // Permission metadata (only for authenticated users)
  sharePermission?: "owner" | "admin" | "write" | "read";
  tokenPermission?: "read" | "write"; // Permission from access token
  isSubscribed?: boolean;
  subscriptionSource?: "guest" | "shared" | "token";
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
