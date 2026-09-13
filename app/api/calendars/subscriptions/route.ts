import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { eq, and, or, ne, isNotNull, isNull } from "drizzle-orm";
import { undismissCalendar, getEffectiveAccessSummary } from "@/lib/auth/permissions";
import {
  isAdminOnlyCapability,
  sanitizeCapabilities,
  type BundleSeedKey,
  type Capability,
} from "@/lib/permission-bundles";

type BundleRef = { id: string; name: string; seedKey: BundleSeedKey | null };

/**
 * A guest bundle's capabilities, ceiling-filtered like every other guest/link
 * source (5.2). Used for "what would I get" previews of a public calendar's
 * guest access — deliberately NOT resolveCalendarAccess()/
 * getEffectiveAccessSummary(), which require an active "subscribed"
 * subscription and would return no access at all for a calendar the caller
 * hasn't subscribed to (or has dismissed) yet, exactly the two cases this
 * preview needs to cover.
 */
function previewGuestCapabilities(capabilities: unknown): Capability[] {
  return sanitizeCapabilities(capabilities).filter(
    (c) => !isAdminOnlyCapability(c)
  );
}

/**
 * GET /api/calendars/subscriptions
 * List all available calendars for discovery
 * Returns two lists:
 * - available: Calendars user can browse (public calendars, showing subscription status)
 * - dismissed: Calendars user has dismissed (both shared and guest-subscribed)
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all public calendars (guestBundleId set, not owned by user)
    const allPublicCalendars = await db.query.calendars.findMany({
      where: and(
        isNotNull(calendars.guestBundleId),
        or(isNull(calendars.ownerId), ne(calendars.ownerId, user.id))
      ),
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
        guestBundle: {
          columns: { id: true, name: true, seedKey: true, capabilities: true },
        },
      },
    });

    // Get all user's subscriptions (both subscribed and dismissed)
    const userSubscriptions = await db.query.userCalendarSubscriptions.findMany(
      {
        where: eq(userCalendarSubscriptions.userId, user.id),
      }
    );

    const subscribedIds = new Set(
      userSubscriptions
        .filter((sub) => sub.status === "subscribed")
        .map((sub) => sub.calendarId)
    );

    const dismissedSubs = userSubscriptions.filter(
      (sub) => sub.status === "dismissed"
    );

    // Get user's explicit shares (not dismissed)
    const userShares = await db.query.calendarShares.findMany({
      where: eq(calendarShares.userId, user.id),
      with: {
        calendar: {
          with: {
            owner: {
              columns: {
                id: true,
                name: true,
              },
            },
            guestBundle: {
              columns: { id: true, name: true, seedKey: true },
            },
          },
        },
      },
    });

    const dismissedIds = new Set(dismissedSubs.map((sub) => sub.calendarId));

    // Filter out dismissed shares from userShares before building sharedIds
    const activeShares = userShares.filter(
      (share) => !dismissedIds.has(share.calendarId)
    );
    const sharedIds = new Set(activeShares.map((share) => share.calendarId));

    // Build available calendars list (public calendars, excluding ones with active shares or dismissed)
    const publicCalendars = allPublicCalendars
      .filter(
        (cal) =>
          !sharedIds.has(cal.id) && // Exclude if user has active share
          !dismissedIds.has(cal.id) // Exclude if user has dismissed this calendar
      )
      .map((cal) => ({
        id: cal.id,
        name: cal.name,
        color: cal.color,
        capabilities: cal.guestBundle
          ? previewGuestCapabilities(cal.guestBundle.capabilities)
          : [],
        bundle: (cal.guestBundle as BundleRef | null) ?? null,
        owner: cal.owner
          ? {
              id: cal.owner.id,
              name: cal.owner.name,
            }
          : null,
        isSubscribed: subscribedIds.has(cal.id),
        source: "guest" as const,
      }));

    // Add shared calendars to available list (already filtered for dismissed
    // in activeShares). A share is unaffected by subscription/dismissal
    // status, so getEffectiveAccessSummary() always resolves it.
    const sharedCalendars = await Promise.all(
      activeShares.map(async (share) => {
        const access = await getEffectiveAccessSummary(
          user.id,
          share.calendar.id
        );
        return {
          id: share.calendar.id,
          name: share.calendar.name,
          color: share.calendar.color,
          capabilities: access?.capabilities ?? [],
          bundle: access?.bundle ?? null,
          guestBundle: (share.calendar.guestBundle as BundleRef | null) ?? null, // for reference
          owner: share.calendar.owner
            ? {
                id: share.calendar.owner.id,
                name: share.calendar.owner.name,
              }
            : null,
          isSubscribed: subscribedIds.has(share.calendarId),
          source: "shared" as const,
        };
      })
    );

    const availableCalendars = [...publicCalendars, ...sharedCalendars];

    // Build dismissed calendars list (both shared and guest-subscribed). A
    // share-backed one resolves through getEffectiveAccessSummary() same as
    // above; a guest-only one previews the guest bundle directly, since
    // dismissing sets status to "dismissed" and resolveCalendarAccess()
    // would otherwise report no access at all for it.
    const dismissedCalendars = await Promise.all(
      dismissedSubs.map(async (sub) => {
        const calendar = await db.query.calendars.findFirst({
          where: eq(calendars.id, sub.calendarId),
          with: {
            owner: {
              columns: {
                id: true,
                name: true,
              },
            },
            guestBundle: {
              columns: { id: true, name: true, seedKey: true, capabilities: true },
            },
          },
        });

        if (!calendar) return null;

        // Check if it's also a shared calendar
        const share = userShares.find((s) => s.calendarId === sub.calendarId);
        const access = share
          ? await getEffectiveAccessSummary(user.id, calendar.id)
          : null;

        const capabilities = access
          ? access.capabilities
          : calendar.guestBundle
            ? previewGuestCapabilities(calendar.guestBundle.capabilities)
            : [];
        const bundle = access
          ? access.bundle
          : ((calendar.guestBundle as BundleRef | null) ?? null);

        return {
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          capabilities,
          bundle,
          owner: calendar.owner
            ? {
                id: calendar.owner.id,
                name: calendar.owner.name,
              }
            : null,
          source: sub.source,
        };
      })
    );

    // Filter out nulls
    const validDismissedCalendars = dismissedCalendars.filter(
      (cal): cal is NonNullable<typeof cal> => cal !== null
    );

    return NextResponse.json({
      available: availableCalendars,
      dismissed: validDismissedCalendars,
    });
  } catch (error) {
    console.error("Error fetching subscription calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendars/subscriptions
 * Subscribe to a calendar or re-subscribe to a dismissed calendar
 * Body: { calendarId: string }
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { calendarId } = body;

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    // Use the helper function to handle both scenarios
    await undismissCalendar(user.id, calendarId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error subscribing to calendar:", error);
    const message =
      error instanceof Error ? error.message : "Failed to subscribe";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
