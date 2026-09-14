import type { CalendarViewSettings } from "./view-settings";
import type { BundleRef, Capability } from "./permission-bundles";

// Re-export types from Drizzle schema
export type { Calendar, Shift, ExternalSync } from "./db/schema";

/** The bundle identity behind a caller's effective access — null for the owner. */
export type CalendarBundleRef = BundleRef;

export interface CalendarWithCount {
  id: string;
  name: string;
  color: string;
  ownerId?: string | null;
  guestBundleId?: string | null;
  signupsEnabled?: boolean;
  /** The calendar's own view; null means everyone sees their personal view */
  viewSettings?: CalendarViewSettings | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  _count?: number;
  // Effective access for the current caller (Stufe 2) — replaces the old
  // sharePermission/tokenPermission/guestPermission enum fields.
  capabilities?: Capability[];
  bundle?: CalendarBundleRef | null;
  isSubscribed?: boolean;
  subscriptionSource?: "guest" | "shared" | "token";
  canSignUpSelf?: boolean;
  canSignUpOthers?: boolean;
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
  signupCapacity?: number | null;
  signups?: ShiftSignupUser[];
  // Optional (not just nullable): the create-mutation's optimistic shift in
  // useShifts.ts predates the server response and has no value for it yet.
  createdBy?: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ShiftSignupUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

export interface CalendarMember {
  id: string;
  name: string | null;
  image?: string | null;
}
