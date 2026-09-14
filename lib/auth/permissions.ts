import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { allowGuestAccess, isAuthEnabled } from "@/lib/auth/feature-flags";
import {
  getTokenPermission,
  getTokensFromCookie,
  validateAccessToken,
} from "@/lib/auth/token-auth";
import type { CalendarMember } from "@/lib/types";

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
 * Permission priority (highest to lowest):
 * 1. Owner (calendar.ownerId matches userId)
 * 2. Shared permission (via calendarShares)
 * 3. Access token (via cookie)
 * 4. Public/Guest permission (for subscribed users or when guest access enabled)
 *
 * For guest users (userId = null), checks:
 * - Access token permission
 * - Guest permission (if auth enabled + guest access enabled + calendar allows it)
 */
export async function getUserCalendarPermission(
  userId: string | null | undefined,
  calendarId: string
): Promise<CalendarPermission | null> {
  return (await getUserCalendarPermissionWithCalendar(userId, calendarId))
    .permission;
}

/**
 * Same resolution as getUserCalendarPermission, but also returns the calendar
 * row it already fetched — lets callers that need calendar columns (e.g.
 * getShiftSignupPermission) avoid a second round trip for the same row.
 */
async function getUserCalendarPermissionWithCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<{
  permission: CalendarPermission | null;
  calendar: typeof calendars.$inferSelect | null;
}> {
  // If auth is disabled, grant full owner access (backwards compatibility)
  if (!isAuthEnabled()) {
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
    });
    return { permission: calendar ? "owner" : null, calendar: calendar ?? null };
  }

  // Fetch calendar first (needed for all checks)
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    return { permission: null, calendar: null };
  }

  // CRITICAL: Orphaned calendars (ownerId=null) are invisible to ALL users
  // They can only be accessed via dedicated admin panel API routes
  if (calendar.ownerId === null) {
    return { permission: null, calendar };
  }

  // If no user ID, check token and guest permissions
  if (!userId) {
    // Check for access token first (higher priority than guest)
    const tokenPermission = await getTokenPermission(calendarId);
    if (tokenPermission) {
      return { permission: tokenPermission, calendar };
    }

    // Guest access only works when explicitly enabled
    if ((await allowGuestAccess()) && calendar.guestPermission !== "none") {
      return {
        permission: calendar.guestPermission as CalendarPermission,
        calendar,
      };
    }
    return { permission: null, calendar };
  }

  // Owner has full control
  if (calendar.ownerId === userId) {
    return { permission: "owner", calendar };
  }

  // Check shared permissions (higher priority than tokens)
  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  if (share) {
    return {
      permission: share.permission as CalendarPermission,
      calendar,
    };
  }

  // Check for access token (authenticated users can also use tokens)
  const tokenPermission = await getTokenPermission(calendarId);
  if (tokenPermission) {
    return { permission: tokenPermission, calendar };
  }

  // Check if user is subscribed to this public calendar
  const subscription = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.calendarId, calendarId),
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.status, "subscribed")
    ),
  });

  // If subscribed and calendar has public access (guestPermission != "none"), return that permission
  // Authenticated users can always access public calendars, regardless of allowGuestAccess setting
  if (subscription && calendar.guestPermission !== "none") {
    return {
      permission: calendar.guestPermission as CalendarPermission,
      calendar,
    };
  }

  return { permission: null, calendar };
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
 * Shift signup permission for a given user on a given calendar.
 * - canManageOwn: may add/remove themselves
 * - canManageOthers: may add/remove any other member
 *
 * Only logged-in users (userId set) can hold signups at all — guests never do,
 * even when a share/access-token grants them "write" on the calendar itself.
 * The calendar-wide signupsEnabled switch (owner/admin only) overrides
 * everything else. A "read"-level member can only self-manage, and only while
 * allowSelfSignup is on; write/admin/owner can always manage anyone.
 */
export async function getShiftSignupPermission(
  userId: string | null | undefined,
  calendarId: string
): Promise<{ canManageOwn: boolean; canManageOthers: boolean }> {
  if (!userId) {
    return { canManageOwn: false, canManageOthers: false };
  }

  const { permission, calendar } = await getUserCalendarPermissionWithCalendar(
    userId,
    calendarId
  );
  if (!permission) {
    return { canManageOwn: false, canManageOthers: false };
  }

  if (!calendar?.signupsEnabled) {
    return { canManageOwn: false, canManageOthers: false };
  }

  if (permission !== "read") {
    // owner / admin / write
    return { canManageOwn: true, canManageOthers: true };
  }

  return {
    canManageOwn: !!calendar.allowSelfSignup,
    canManageOthers: false,
  };
}

/**
 * Get all calendar IDs accessible to a user (or guest)
 * Returns array of calendar IDs with their permission levels
 *
 * For guest users (userId = null), returns:
 * - Calendars accessible via access tokens (always, regardless of allowGuestAccess)
 * - Calendars with guestPermission != "none" (only if guest access is enabled)
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

  // Guest access: return calendars accessible via tokens or guest permissions
  if (!userId) {
    const results: Array<{ id: string; permission: CalendarPermission }> = [];
    const existingIds = new Set<string>();

    // Token-based access and the guest-access flag don't depend on each
    // other, so resolve them concurrently instead of one after another.
    const [tokens, guestAccessEnabled] = await Promise.all([
      getTokensFromCookie(),
      allowGuestAccess(),
    ]);

    // First, check for token-based access (always works, regardless of allowGuestAccess)
    for (const tokenData of tokens) {
      // Validate token is still valid
      const validation = await validateAccessToken(tokenData.token);
      if (validation && validation.calendarId === tokenData.calendarId) {
        results.push({
          id: tokenData.calendarId,
          permission: tokenData.permission as CalendarPermission,
        });
        existingIds.add(tokenData.calendarId);
      }
    }

    // Then, check for guest permissions (only if guest access is enabled)
    if (guestAccessEnabled) {
      const guestAccessibleCalendars = await db.query.calendars.findMany({
        where: (calendars, { ne }) => ne(calendars.guestPermission, "none"),
      });

      for (const cal of guestAccessibleCalendars) {
        if (!existingIds.has(cal.id)) {
          results.push({
            id: cal.id,
            permission: cal.guestPermission as CalendarPermission,
          });
          existingIds.add(cal.id);
        }
      }
    }

    return results;
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

  // Get all subscriptions for this user (including dismissed)
  const subscriptions = await db.query.userCalendarSubscriptions.findMany({
    where: eq(userCalendarSubscriptions.userId, userId),
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
    const isDismissed = subscriptions.find(
      (sub) => sub.calendarId === share.calendarId && sub.status === "dismissed"
    );

    if (!isDismissed) {
      results.push({
        id: share.calendarId,
        permission: share.permission as CalendarPermission,
      });
      existingIds.add(share.calendarId);
    }
  }

  // Add guest-subscribed calendars (only if not already included via shares and not dismissed)
  for (const sub of subscriptions) {
    if (existingIds.has(sub.calendarId)) continue;
    if (sub.calendar.guestPermission === "none") continue;
    if (sub.source !== "guest") continue;
    if (sub.status === "dismissed") continue; // Skip dismissed guest subscriptions

    results.push({
      id: sub.calendarId,
      permission: sub.calendar.guestPermission as CalendarPermission,
    });
    existingIds.add(sub.calendarId);
  }

  // Add token-accessible calendars (authenticated users can also use access tokens)
  const tokens = await getTokensFromCookie();
  for (const tokenData of tokens) {
    if (existingIds.has(tokenData.calendarId)) continue;

    // Validate token is still valid
    const validation = await validateAccessToken(tokenData.token);
    if (validation && validation.calendarId === tokenData.calendarId) {
      results.push({
        id: tokenData.calendarId,
        permission: tokenData.permission as CalendarPermission,
      });
      existingIds.add(tokenData.calendarId);
    }
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

/**
 * Minimal member list (owner + shares) for a calendar, deduped by user id.
 * Returns null if the calendar doesn't exist.
 */
export async function getCalendarMembers(
  calendarId: string
): Promise<CalendarMember[] | null> {
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
    columns: { id: true },
    with: {
      owner: { columns: { id: true, name: true, image: true } },
    },
  });

  if (!calendar) {
    return null;
  }

  const shares = await db.query.calendarShares.findMany({
    where: eq(calendarShares.calendarId, calendarId),
    with: {
      user: { columns: { id: true, name: true, image: true } },
    },
  });

  const members = new Map<string, CalendarMember>();

  if (calendar.owner) {
    members.set(calendar.owner.id, calendar.owner);
  }
  for (const share of shares) {
    members.set(share.user.id, share.user);
  }

  return Array.from(members.values());
}

/**
 * Get all orphaned calendars (calendars with ownerId=null)
 * ADMIN-ONLY function - must check admin permissions before calling
 *
 * This function is used exclusively by the Admin Panel to list calendars
 * that need owner assignment. Normal calendar APIs exclude these calendars.
 *
 * @returns Promise<Array> - List of orphaned calendars with basic info
 */
export async function getOrphanedCalendars() {
  const orphanedCalendars = await db.query.calendars.findMany({
    where: isNull(calendars.ownerId),
    columns: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return orphanedCalendars;
}
