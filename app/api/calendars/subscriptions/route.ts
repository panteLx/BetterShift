import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { eq, and, or, ne, isNull } from "drizzle-orm";
import { undismissCalendar } from "@/lib/auth/permissions";

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
    // Get all public calendars (guestPermission != "none", not owned by user)
    const allPublicCalendars = await db.query.calendars.findMany({
      where: and(
        ne(calendars.guestPermission, "none"),
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
        guestPermission: cal.guestPermission,
        owner: cal.owner
          ? {
              id: cal.owner.id,
              name: cal.owner.name,
            }
          : null,
        isSubscribed: subscribedIds.has(cal.id),
        source: "guest" as const,
      }));

    // Add shared calendars to available list (already filtered for dismissed in activeShares)
    const sharedCalendars = activeShares.map((share) => ({
      id: share.calendar.id,
      name: share.calendar.name,
      color: share.calendar.color,
      permission: share.permission, // User's share permission level
      guestPermission: share.calendar.guestPermission, // Calendar's guest permission (for reference)
      owner: share.calendar.owner
        ? {
            id: share.calendar.owner.id,
            name: share.calendar.owner.name,
          }
        : null,
      isSubscribed: subscribedIds.has(share.calendarId),
      source: "shared" as const,
    }));

    const availableCalendars = [...publicCalendars, ...sharedCalendars];

    // Build dismissed calendars list (both shared and guest-subscribed)
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
          },
        });

        if (!calendar) return null;

        // Check if it's also a shared calendar
        const share = userShares.find((s) => s.calendarId === sub.calendarId);

        return {
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          permission: share ? share.permission : calendar.guestPermission,
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
