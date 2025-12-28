import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  shifts,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { sql, eq, or, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getUserAccessibleCalendars } from "@/lib/auth/permissions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { rateLimit } from "@/lib/rate-limiter";

// GET all calendars (only those accessible to the user)
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request.headers);

    // Get accessible calendar IDs with permissions
    const accessible = await getUserAccessibleCalendars(user?.id);
    const accessibleIds = accessible.map((a) => a.id);

    if (accessibleIds.length === 0) {
      return NextResponse.json([]);
    }

    // Create a permission map for quick lookup
    const permissionMap = new Map(accessible.map((a) => [a.id, a]));

    // Fetch calendars with counts
    const userCalendars = await db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        ownerId: calendars.ownerId,
        guestPermission: calendars.guestPermission,
        createdAt: calendars.createdAt,
        updatedAt: calendars.updatedAt,
        _count:
          sql<number>`(SELECT COUNT(*) FROM ${shifts} WHERE ${shifts.calendarId} = ${calendars.id})`.as(
            "_count"
          ),
      })
      .from(calendars)
      .where(or(...accessibleIds.map((id) => eq(calendars.id, id))))
      .orderBy(calendars.createdAt);

    // If user is authenticated, fetch additional metadata
    let subscriptions: Map<string, { status: string; source: string }> =
      new Map();
    let shares: Map<string, string> = new Map();

    if (user) {
      // Get subscriptions
      const userSubs = await db.query.userCalendarSubscriptions.findMany({
        where: and(
          eq(sql`${userCalendarSubscriptions.userId}`, user.id),
          eq(sql`${userCalendarSubscriptions.status}`, "subscribed")
        ),
      });
      subscriptions = new Map(
        userSubs.map((s) => [
          s.calendarId,
          { status: s.status, source: s.source },
        ])
      );

      // Get shares
      const userShares = await db.query.calendarShares.findMany({
        where: eq(sql`${calendarShares.userId}`, user.id),
      });
      shares = new Map(userShares.map((s) => [s.calendarId, s.permission]));
    }

    // Enrich calendars with permission metadata
    const enrichedCalendars = userCalendars.map((cal) => {
      const isOwner = user && cal.ownerId === user.id;
      const share = shares.get(cal.id);
      const subscription = subscriptions.get(cal.id);

      return {
        ...cal,
        sharePermission: share || undefined,
        isSubscribed: !!subscription,
        subscriptionSource: subscription?.source || undefined,
      };
    });

    return NextResponse.json(enrichedCalendars);
  } catch (error) {
    console.error("Failed to fetch calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

// POST create new calendar (sets current user as owner)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);

    // Rate limiting: 10 calendars per hour
    const rateLimitResponse = rateLimit(request, user?.id, "calendar-create");
    if (rateLimitResponse) return rateLimitResponse;

    // If auth is enabled, require authentication to create calendars
    if (isAuthEnabled() && !user) {
      return NextResponse.json(
        { error: "Authentication required to create calendars" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Calendar name is required" },
        { status: 400 }
      );
    }

    const [calendar] = await db
      .insert(calendars)
      .values({
        name,
        color: color || "#3b82f6",
        ownerId: user?.id || null, // Set current user as owner (or null if auth disabled)
      })
      .returning();

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    console.error("Failed to create calendar:", error);
    return NextResponse.json(
      { error: "Failed to create calendar" },
      { status: 500 }
    );
  }
}
