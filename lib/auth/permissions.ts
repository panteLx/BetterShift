import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { allowGuestAccess, isAuthEnabled } from "@/lib/auth/feature-flags";

/**
 * Calendar permission levels
 * - owner: Full control, can delete calendar
 * - admin: Can manage calendar settings and shares
 * - write: Can create/edit/delete shifts, presets, notes
 * - read: Can only view calendar data
 */
export type CalendarPermission = "owner" | "admin" | "write" | "read";

/**
 * Guest permission levels (subset of CalendarPermission)
 * - none: No guest access
 * - read: Guests can view calendar data
 * - write: Guests can create/edit/delete shifts, presets, notes
 */
export type GuestPermission = "none" | "read" | "write";

/**
 * Get user's permission level for a specific calendar
 * Returns null if user has no access to the calendar
 *
 * For guest users (userId = null), returns guest permission if:
 * - Auth is enabled
 * - Guest access is enabled
 * - Calendar has guestPermission != "none"
 */
export async function getUserCalendarPermission(
  userId: string | null | undefined,
  calendarId: string
): Promise<CalendarPermission | null> {
  // If auth is disabled, grant full owner access (backwards compatibility)
  if (!isAuthEnabled()) {
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
    });
    return calendar ? "owner" : null;
  }

  // Fetch calendar first (needed for both authenticated and guest users)
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    return null;
  }

  // If no user ID, check guest permissions
  if (!userId) {
    // Guest access only works when explicitly enabled
    if (allowGuestAccess() && calendar.guestPermission !== "none") {
      return calendar.guestPermission as CalendarPermission;
    }
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

  if (share) {
    return share.permission as CalendarPermission;
  }

  // Check if user is subscribed to this public calendar
  const subscription = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.calendarId, calendarId),
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.status, "subscribed")
    ),
  });

  // If subscribed and calendar is public, return guest permission
  if (subscription && calendar.guestPermission !== "none") {
    return calendar.guestPermission as CalendarPermission;
  }

  return null;
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
 * Get all calendar IDs accessible to a user (or guest)
 * Returns array of calendar IDs with their permission levels
 *
 * For guest users (userId = null), returns calendars with guestPermission != "none"
 * if guest access is enabled.
 */
export async function getUserAccessibleCalendars(
  userId: string | null | undefined
): Promise<Array<{ id: string; permission: CalendarPermission }>> {
  // If auth is disabled, return all calendars with owner permission (backwards compatibility)
  if (!isAuthEnabled()) {
    const allCalendars = await db.query.calendars.findMany();
    return allCalendars.map((cal) => ({
      id: cal.id,
      permission: "owner" as const,
    }));
  }

  // Guest access: return calendars with guest permissions
  if (!userId) {
    if (!allowGuestAccess()) {
      return [];
    }

    const guestAccessibleCalendars = await db.query.calendars.findMany({
      where: (calendars, { ne }) => ne(calendars.guestPermission, "none"),
    });

    return guestAccessibleCalendars.map((cal) => ({
      id: cal.id,
      permission: cal.guestPermission as CalendarPermission,
    }));
  }

  const results: Array<{ id: string; permission: CalendarPermission }> = [];

  // Get owned calendars (ALWAYS visible, cannot be dismissed)
  const ownedCalendars = await db.query.calendars.findMany({
    where: eq(calendars.ownerId, userId),
  });

  results.push(
    ...ownedCalendars.map((cal) => ({
      id: cal.id,
      permission: "owner" as const,
    }))
  );

  // Get all subscriptions for this user
  const subscriptions = await db.query.userCalendarSubscriptions.findMany({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.status, "subscribed")
    ),
    with: {
      calendar: true,
    },
  });

  // Get shared calendars (not owned by user)
  const sharedCalendars = await db.query.calendarShares.findMany({
    where: eq(calendarShares.userId, userId),
    with: {
      calendar: true,
    },
  });

  // Track which calendars exist to prevent duplicates
  const existingIds = new Set(results.map((r) => r.id));

  // Add shared calendars (share permission takes precedence over guest permission)
  for (const share of sharedCalendars) {
    if (existingIds.has(share.calendarId)) continue; // Skip if owned

    // Check if user has dismissed this shared calendar
    const dismissedShare = subscriptions.find(
      (sub) =>
        sub.calendarId === share.calendarId &&
        sub.status === "dismissed" &&
        sub.source === "shared"
    );

    if (!dismissedShare) {
      results.push({
        id: share.calendarId,
        permission: share.permission as CalendarPermission,
      });
      existingIds.add(share.calendarId);
    }
  }

  // Add guest-subscribed calendars (only if not already included via shares)
  for (const sub of subscriptions) {
    if (existingIds.has(sub.calendarId)) continue;
    if (sub.calendar.guestPermission === "none") continue;
    if (sub.source !== "guest") continue;

    results.push({
      id: sub.calendarId,
      permission: sub.calendar.guestPermission as CalendarPermission,
    });
  }

  return results;
}

/**
 * Check if a calendar is dismissed by the user
 */
export async function isCalendarDismissed(
  userId: string,
  calendarId: string
): Promise<boolean> {
  const subscription = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.calendarId, calendarId),
      eq(userCalendarSubscriptions.status, "dismissed")
    ),
  });

  return !!subscription;
}

/**
 * Dismiss/Unsubscribe from a calendar (hide it from view)
 * - Throws error if user tries to dismiss their own calendar
 * - For shared calendars: creates/updates subscription with status="dismissed", source="shared"
 * - For guest-subscribed calendars: updates subscription to status="dismissed"
 */
export async function dismissCalendar(
  userId: string,
  calendarId: string
): Promise<void> {
  // Check if user owns the calendar
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    throw new Error("Calendar not found");
  }

  if (calendar.ownerId === userId) {
    throw new Error("Cannot dismiss your own calendar");
  }

  // Check if it's a shared calendar
  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  // Check if subscription already exists
  const existingSub = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.calendarId, calendarId)
    ),
  });

  if (existingSub) {
    // Update existing subscription to dismissed
    await db
      .update(userCalendarSubscriptions)
      .set({
        status: "dismissed",
        source: share ? "shared" : "guest",
        updatedAt: new Date(),
      })
      .where(eq(userCalendarSubscriptions.id, existingSub.id));
  } else {
    // Create new dismissal entry
    await db.insert(userCalendarSubscriptions).values({
      userId,
      calendarId,
      status: "dismissed",
      source: share ? "shared" : "guest",
    });
  }
}

/**
 * Re-subscribe to a dismissed calendar
 * - For shared calendars: updates status to "subscribed"
 * - For public calendars: updates/creates subscription with status="subscribed", source="guest"
 */
export async function undismissCalendar(
  userId: string,
  calendarId: string
): Promise<void> {
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    throw new Error("Calendar not found");
  }

  if (calendar.ownerId === userId) {
    throw new Error("Cannot subscribe to your own calendar");
  }

  // Check if it's a shared calendar
  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  // For guest calendars, verify it's public
  if (!share && calendar.guestPermission === "none") {
    throw new Error("Calendar is not public");
  }

  // Check if subscription exists
  const existingSub = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.calendarId, calendarId)
    ),
  });

  if (existingSub) {
    // Update to subscribed
    await db
      .update(userCalendarSubscriptions)
      .set({
        status: "subscribed",
        source: share ? "shared" : "guest",
        updatedAt: new Date(),
      })
      .where(eq(userCalendarSubscriptions.id, existingSub.id));
  } else {
    // Create new subscription
    await db.insert(userCalendarSubscriptions).values({
      userId,
      calendarId,
      status: "subscribed",
      source: share ? "shared" : "guest",
    });
  }
}
