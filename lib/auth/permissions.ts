import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  calendarPermissionBundles,
  userCalendarSubscriptions,
  type CalendarPermissionBundle,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { allowGuestAccess, isAuthEnabled } from "@/lib/auth/feature-flags";
import {
  getTokenBundleId,
  getTokensFromCookie,
  validateAccessToken,
} from "@/lib/auth/token-auth";
import type { CalendarBundleRef, CalendarMember } from "@/lib/types";
import {
  CAPABILITIES,
  isAdminOnlyCapability,
  sanitizeBundle,
  type BundleDefinition,
  type Capability,
} from "@/lib/permission-bundles";

async function getBundleById(
  bundleId: string
): Promise<CalendarPermissionBundle | null> {
  const bundle = await db.query.calendarPermissionBundles.findFirst({
    where: eq(calendarPermissionBundles.id, bundleId),
  });
  return bundle ? sanitizeBundle(bundle) : null;
}

interface ResolvedCalendarAccess {
  isOwner: boolean;
  source: "owner" | "share" | "token" | "guestBundle";
  capabilities: Capability[];
  calendar: typeof calendars.$inferSelect;
  /** null for the owner/auth-disabled branches, which never go through a bundle. */
  bundle: CalendarBundleRef | null;
}

function ownerAccess(calendar: typeof calendars.$inferSelect): ResolvedCalendarAccess {
  return {
    isOwner: true,
    source: "owner",
    capabilities: [...CAPABILITIES],
    calendar,
    bundle: null,
  };
}

function bundleAccess(
  calendar: typeof calendars.$inferSelect,
  source: "share" | "token" | "guestBundle",
  bundle: CalendarPermissionBundle
): ResolvedCalendarAccess {
  return {
    isOwner: false,
    source,
    capabilities: bundle.capabilities,
    calendar,
    bundle: { id: bundle.id, name: bundle.name, seedKey: bundle.seedKey },
  };
}

/**
 * Resolves what a caller may do on a calendar: owner (everything), or the
 * capability set of whichever bundle they hold (share > token > guest bundle
 * for authenticated users; token > guest bundle for guests). Returns null
 * when the calendar doesn't exist, is orphaned, or grants no access at all.
 */
async function resolveCalendarAccess(
  userId: string | null | undefined,
  calendarId: string
): Promise<ResolvedCalendarAccess | null> {
  // guestBundle fetched alongside the calendar (one hop via the relation)
  // since almost every branch below may need it.
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
    with: { guestBundle: true },
  });
  if (!calendar) return null;

  // If auth is disabled, grant full owner access (backwards compatibility)
  if (!isAuthEnabled()) {
    return ownerAccess(calendar);
  }

  // CRITICAL: Orphaned calendars (ownerId=null) are invisible to ALL users.
  // They can only be accessed via dedicated admin panel API routes.
  if (calendar.ownerId === null) return null;

  const guestBundle = calendar.guestBundle ? sanitizeBundle(calendar.guestBundle) : null;

  if (!userId) {
    const tokenBundleId = await getTokenBundleId(calendarId);
    if (tokenBundleId) {
      const bundle = await getBundleById(tokenBundleId);
      if (bundle) return bundleAccess(calendar, "token", bundle);
    }
    if (allowGuestAccess() && guestBundle) {
      return bundleAccess(calendar, "guestBundle", guestBundle);
    }
    return null;
  }

  if (calendar.ownerId === userId) {
    return ownerAccess(calendar);
  }

  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
    with: { bundle: true },
  });
  if (share?.bundle) {
    return bundleAccess(calendar, "share", sanitizeBundle(share.bundle));
  }

  const tokenBundleId = await getTokenBundleId(calendarId);
  if (tokenBundleId) {
    const bundle = await getBundleById(tokenBundleId);
    if (bundle) return bundleAccess(calendar, "token", bundle);
  }

  // Authenticated users can always access public calendars they're
  // subscribed to, regardless of the allowGuestAccess() setting.
  const subscription = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.calendarId, calendarId),
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.status, "subscribed")
    ),
  });
  if (subscription && guestBundle) {
    return bundleAccess(calendar, "guestBundle", guestBundle);
  }

  return null;
}

export interface CalendarAccess {
  isOwner: boolean;
  /** Whether the caller may perform a specific capability on the calendar. */
  can(capability: Capability): boolean;
  /**
   * Whether the caller may act on a specific resource (a shift, preset or
   * note) given the two capabilities that gate it and who created it (E1).
   * `any` covers every resource regardless of creator; `own` only covers
   * resources with no known creator or created by the caller (E8) — for an
   * anonymous guest (no userId) that means only creator-less resources
   * count as "own" (E9's authenticated-guest exception doesn't apply here,
   * this is ownership, not signup eligibility).
   */
  canOwned(own: Capability, any: Capability, createdBy: string | null): boolean;
}

/**
 * Applies the hard ceiling that keeps guest/link access from ever reaching
 * administrative capabilities (manageShares, manageGuestAccess,
 * manageCalendarSettings, manageExternalSync, deleteSyncLogs), even if a
 * bundle was somehow misconfigured to include them — the actual security
 * boundary behind GUEST_INELIGIBLE in lib/permission-bundles.ts. Owners get
 * every capability; a "share" source is never ceilinged (invited users may
 * legitimately hold admin-only capabilities).
 */
function ceilingFilteredCapabilities(access: ResolvedCalendarAccess): Capability[] {
  if (access.isOwner) return [...CAPABILITIES];
  if (access.source === "share") return access.capabilities;
  return access.capabilities.filter((c) => !isAdminOnlyCapability(c));
}

/**
 * Resolves a caller's access to a calendar once and returns an object with
 * `can()`/`canOwned()` so routes that need several checks don't re-resolve
 * calendar/share/token/guest-bundle lookups per check. `hasCapability()` and
 * `hasOwnedCapability()` below are thin single-check convenience wrappers.
 */
export async function getCalendarAccess(
  userId: string | null | undefined,
  calendarId: string
): Promise<CalendarAccess | null> {
  const access = await resolveCalendarAccess(userId, calendarId);
  if (!access) return null;

  const effective = ceilingFilteredCapabilities(access);
  const can = (capability: Capability): boolean => effective.includes(capability);

  const canOwned = (
    own: Capability,
    any: Capability,
    createdBy: string | null
  ): boolean => {
    if (access.isOwner) return true;
    if (can(any)) return true;
    if (!can(own)) return false;
    return createdBy === null || createdBy === (userId ?? null);
  };

  return { isOwner: access.isOwner, can, canOwned };
}

export interface EffectiveAccessSummary {
  isOwner: boolean;
  capabilities: Capability[];
  /** null for the owner and for auth-disabled — every other source resolves through a bundle. */
  bundle: CalendarBundleRef | null;
}

/**
 * Ceiling-filtered capabilities plus the bundle they came from, for API
 * responses that hand the client its own effective access (calendar list,
 * subscriptions) instead of the old sharePermission/tokenPermission/
 * guestPermission enum fields. Client-side gating should check these
 * capabilities directly rather than re-deriving a coarse level.
 */
export async function getEffectiveAccessSummary(
  userId: string | null | undefined,
  calendarId: string
): Promise<EffectiveAccessSummary | null> {
  const access = await resolveCalendarAccess(userId, calendarId);
  if (!access) return null;
  return {
    isOwner: access.isOwner,
    capabilities: ceilingFilteredCapabilities(access),
    bundle: access.isOwner ? null : access.bundle,
  };
}

/**
 * Whether the caller may perform a specific capability on a calendar. This
 * is the primary enforcement API for calendar-wide capabilities — route
 * handlers should check exactly the capability their action needs, not a
 * coarse level. For own/any-gated resources use hasOwnedCapability(), and
 * for several checks on the same request prefer getCalendarAccess() once.
 */
export async function hasCapability(
  userId: string | null | undefined,
  calendarId: string,
  capability: Capability
): Promise<boolean> {
  const access = await getCalendarAccess(userId, calendarId);
  return access ? access.can(capability) : false;
}

/** Single-check convenience wrapper around CalendarAccess.canOwned() — see there. */
export async function hasOwnedCapability(
  userId: string | null | undefined,
  calendarId: string,
  own: Capability,
  any: Capability,
  createdBy: string | null
): Promise<boolean> {
  const access = await getCalendarAccess(userId, calendarId);
  return access ? access.canOwned(own, any, createdBy) : false;
}

/**
 * Whether the caller has any access to a calendar at all (works for both
 * authenticated users and guests). Used by GET routes that only need to
 * gate presence, not a specific capability — viewShifts/viewNotesEvents/
 * viewStats are in every seeded and migrated bundle, so this is normally
 * equivalent to "has view access", without depending on a custom bundle
 * having ticked a specific view capability.
 */
export async function canViewCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return (await resolveCalendarAccess(userId, calendarId)) !== null;
}

export async function isCalendarOwner(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  const access = await getCalendarAccess(userId, calendarId);
  return access?.isOwner ?? false;
}

/**
 * Check if user can delete the calendar (owner only)
 */
export async function canDeleteCalendar(
  userId: string | null | undefined,
  calendarId: string
): Promise<boolean> {
  return isCalendarOwner(userId, calendarId);
}

/**
 * Shift signup permission for a given user on a given calendar.
 * - canManageOwn: may add/remove themselves
 * - canManageOthers: may add/remove any other member
 *
 * Only logged-in users (userId set) can hold signups at all — guests never
 * do, even when a token/guest bundle grants them signUpSelf/signUpOthers on
 * the calendar itself. The calendar-wide signupsEnabled switch (gated by
 * manageCalendarSettings) overrides everything else.
 */
export async function getShiftSignupPermission(
  userId: string | null | undefined,
  calendarId: string
): Promise<{ canManageOwn: boolean; canManageOthers: boolean }> {
  const access = await resolveCalendarAccess(userId, calendarId);
  if (!access || !access.calendar.signupsEnabled) {
    return { canManageOwn: false, canManageOthers: false };
  }
  if (access.isOwner) {
    return { canManageOwn: true, canManageOthers: true };
  }
  if (!userId) {
    return { canManageOwn: false, canManageOthers: false };
  }
  return {
    canManageOwn: access.capabilities.includes("signUpSelf"),
    canManageOthers: access.capabilities.includes("signUpOthers"),
  };
}

/**
 * Resolves which of the given bundle ids still exist. guestBundleId has no
 * DB-level FK (see lib/db/schema.ts), so a bundle deletion (Stufe 2) can
 * leave it pointing at nothing — callers must treat that the same as "no
 * guest access" rather than resolving it anyway (4.2/4.3 of the design doc).
 */
async function existingBundleIds(
  ids: Iterable<string>
): Promise<Set<string>> {
  const idList = Array.from(new Set(ids));
  if (idList.length === 0) return new Set();
  const rows = await db.query.calendarPermissionBundles.findMany({
    where: (b, { inArray }) => inArray(b.id, idList),
    columns: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/**
 * Get all calendar IDs accessible to a user (or guest), with an isOwner flag.
 *
 * For guest users (userId = null), returns:
 * - Calendars accessible via access tokens (always, regardless of allowGuestAccess)
 * - Calendars with a guestBundleId set (only if guest access is enabled)
 */
export async function getUserAccessibleCalendars(
  userId: string | null | undefined
): Promise<Array<{ id: string; isOwner: boolean }>> {
  if (!isAuthEnabled()) {
    const allCalendars = await db.query.calendars.findMany({
      columns: { id: true },
    });
    return allCalendars.map((cal) => ({ id: cal.id, isOwner: true }));
  }

  if (!userId) {
    const results: Array<{ id: string; isOwner: boolean }> = [];
    const existingIds = new Set<string>();

    const tokens = await getTokensFromCookie();
    for (const tokenData of tokens) {
      const validation = await validateAccessToken(tokenData.token);
      if (validation && validation.calendarId === tokenData.calendarId) {
        results.push({ id: tokenData.calendarId, isOwner: false });
        existingIds.add(tokenData.calendarId);
      }
    }

    if (allowGuestAccess()) {
      const guestAccessibleCalendars = await db.query.calendars.findMany({
        where: (calendars, { isNotNull }) => isNotNull(calendars.guestBundleId),
        columns: { id: true, guestBundleId: true },
      });
      const liveBundleIds = await existingBundleIds(
        guestAccessibleCalendars.map((cal) => cal.guestBundleId!)
      );
      for (const cal of guestAccessibleCalendars) {
        if (existingIds.has(cal.id)) continue;
        if (!liveBundleIds.has(cal.guestBundleId!)) continue;
        results.push({ id: cal.id, isOwner: false });
        existingIds.add(cal.id);
      }
    }

    return results;
  }

  const results: Array<{ id: string; isOwner: boolean }> = [];

  const [ownedCalendars, subscriptions, sharedCalendars] = await Promise.all([
    db.query.calendars.findMany({
      where: eq(calendars.ownerId, userId),
      columns: { id: true },
    }),
    db.query.userCalendarSubscriptions.findMany({
      where: eq(userCalendarSubscriptions.userId, userId),
      with: { calendar: true },
    }),
    db.query.calendarShares.findMany({
      where: eq(calendarShares.userId, userId),
    }),
  ]);
  results.push(...ownedCalendars.map((cal) => ({ id: cal.id, isOwner: true })));

  const existingIds = new Set(results.map((r) => r.id));

  for (const share of sharedCalendars) {
    if (existingIds.has(share.calendarId)) continue;
    const isDismissed = subscriptions.find(
      (sub) => sub.calendarId === share.calendarId && sub.status === "dismissed"
    );
    if (!isDismissed) {
      results.push({ id: share.calendarId, isOwner: false });
      existingIds.add(share.calendarId);
    }
  }

  const subscriptionGuestBundleIds = await existingBundleIds(
    subscriptions
      .map((sub) => sub.calendar.guestBundleId)
      .filter((id): id is string => id !== null)
  );
  for (const sub of subscriptions) {
    if (existingIds.has(sub.calendarId)) continue;
    if (!sub.calendar.guestBundleId) continue;
    if (!subscriptionGuestBundleIds.has(sub.calendar.guestBundleId)) continue;
    if (sub.source !== "guest") continue;
    if (sub.status === "dismissed") continue;
    results.push({ id: sub.calendarId, isOwner: false });
    existingIds.add(sub.calendarId);
  }

  const tokens = await getTokensFromCookie();
  for (const tokenData of tokens) {
    if (existingIds.has(tokenData.calendarId)) continue;
    const validation = await validateAccessToken(tokenData.token);
    if (validation && validation.calendarId === tokenData.calendarId) {
      results.push({ id: tokenData.calendarId, isOwner: false });
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
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
  });

  if (!calendar) {
    throw new Error("Calendar not found");
  }

  if (calendar.ownerId === userId) {
    throw new Error("Cannot dismiss your own calendar");
  }

  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  const existingSub = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.calendarId, calendarId)
    ),
  });

  if (existingSub) {
    await db
      .update(userCalendarSubscriptions)
      .set({
        status: "dismissed",
        source: share ? "shared" : "guest",
        updatedAt: new Date(),
      })
      .where(eq(userCalendarSubscriptions.id, existingSub.id));
  } else {
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

  const share = await db.query.calendarShares.findFirst({
    where: and(
      eq(calendarShares.calendarId, calendarId),
      eq(calendarShares.userId, userId)
    ),
  });

  const hasLiveGuestBundle =
    !!calendar.guestBundleId &&
    (await existingBundleIds([calendar.guestBundleId])).size > 0;

  if (!share && !hasLiveGuestBundle) {
    throw new Error("Calendar is not public");
  }

  const existingSub = await db.query.userCalendarSubscriptions.findFirst({
    where: and(
      eq(userCalendarSubscriptions.userId, userId),
      eq(userCalendarSubscriptions.calendarId, calendarId)
    ),
  });

  if (existingSub) {
    await db
      .update(userCalendarSubscriptions)
      .set({
        status: "subscribed",
        source: share ? "shared" : "guest",
        updatedAt: new Date(),
      })
      .where(eq(userCalendarSubscriptions.id, existingSub.id));
  } else {
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

// =====================================================
// Permission bundle seeding
// =====================================================

export async function listPermissionBundles(
  calendarId: string
): Promise<CalendarPermissionBundle[]> {
  const rows = await db.query.calendarPermissionBundles.findMany({
    where: eq(calendarPermissionBundles.calendarId, calendarId),
    orderBy: (bundles, { asc }) => [asc(bundles.createdAt)],
  });
  return rows.map(sanitizeBundle);
}

/**
 * Inserts the given bundle definitions for a calendar and returns the
 * created rows. Synchronous (not async) so a caller can seed bundles
 * atomically with the calendar row itself inside a db.transaction()
 * callback (see POST /api/calendars) — better-sqlite3 transactions must be
 * fully synchronous, they reject a callback that returns a promise.
 * Accepts an optional transaction executor, defaulting to the module-level
 * db for callers outside a transaction.
 */
export function seedPermissionBundles(
  calendarId: string,
  definitions: BundleDefinition[],
  executor: Pick<typeof db, "insert"> = db
): CalendarPermissionBundle[] {
  return executor
    .insert(calendarPermissionBundles)
    .values(
      definitions.map((def) => ({
        calendarId,
        name: def.name,
        seedKey: def.seedKey,
        capabilities: def.capabilities,
      }))
    )
    .returning()
    .all();
}
