import { db } from "@/lib/db";
import { calendars, calendarShares } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Calendar permission levels
 * - owner: Full control, can delete calendar
 * - admin: Can manage calendar settings and shares
 * - write: Can create/edit/delete shifts, presets, notes
 * - read: Can only view calendar data
 */
export type CalendarPermission = "owner" | "admin" | "write" | "read";

/**
 * Get user's permission level for a specific calendar
 * Returns null if user has no access to the calendar
 */
export async function getUserCalendarPermission(
  userId: string | null | undefined,
  calendarId: string
): Promise<CalendarPermission | null> {
  // No user = no permission
  if (!userId) {
    return null;
  }

  // Check if user is the owner
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    return null;
  }

  // Owner has full control
  if (calendar.ownerId === userId) {
    return "owner";
  }

  // Check shared permissions
  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  if (!share) {
    return null;
  }

  return share.permission as CalendarPermission;
}

/**
 * Check if user has at least the required permission level
 */
export async function checkPermission(
  userId: string | null | undefined,
  calendarId: string,
  required: CalendarPermission
): Promise<boolean> {
  const userPermission = await getUserCalendarPermission(userId, calendarId);

  if (!userPermission) {
    return false;
  }

  // Permission hierarchy: owner > admin > write > read
  const hierarchy: CalendarPermission[] = ["owner", "admin", "write", "read"];
  const userLevel = hierarchy.indexOf(userPermission);
  const requiredLevel = hierarchy.indexOf(required);

  return userLevel <= requiredLevel;
}

/**
 * Check if user can view a calendar
 */
export async function canViewCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return checkPermission(userId, calendarId, "read");
}

/**
 * Check if user can edit calendar data (shifts, presets, notes)
 */
export async function canEditCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return checkPermission(userId, calendarId, "write");
}

/**
 * Check if user can manage calendar settings and shares
 */
export async function canManageCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return checkPermission(userId, calendarId, "admin");
}

/**
 * Check if user can delete the calendar (owner only)
 */
export async function canDeleteCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return checkPermission(userId, calendarId, "owner");
}

/**
 * Get all calendar IDs accessible to a user
 * Returns array of calendar IDs with their permission levels
 */
export async function getUserAccessibleCalendars(
  userId: string | null | undefined
): Promise<Array<{ id: string; permission: CalendarPermission }>> {
  if (!userId) {
    return [];
  }

  const results: Array<{ id: string; permission: CalendarPermission }> = [];

  // Get owned calendars
  const ownedCalendars = await db.query.calendars.findMany({
    where: eq(calendars.ownerId, userId),
  });

  results.push(
    ...ownedCalendars.map((cal) => ({
      id: cal.id,
      permission: "owner" as const,
    }))
  );

  // Get shared calendars
  const sharedCalendars = await db.query.calendarShares.findMany({
    where: eq(calendarShares.userId, userId),
    with: {
      calendar: true,
    },
  });

  results.push(
    ...sharedCalendars.map((share) => ({
      id: share.calendarId,
      permission: share.permission as CalendarPermission,
    }))
  );

  return results;
}
