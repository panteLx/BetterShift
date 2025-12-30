import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  shifts,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { sql, eq, or, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { getUserAccessibleCalendars } from "@/lib/auth/permissions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarCreatedMetadata } from "@/lib/audit-log";
import {
  getTokensFromCookie,
  validateAccessToken,
} from "@/lib/auth/token-auth";

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
    const tokens: Map<string, "read" | "write"> = new Map();

    // Get token permissions (works for both guests and authenticated users)
    const userTokens = await getTokensFromCookie();
    for (const tokenData of userTokens) {
      // Validate token is still valid
      const validation = await validateAccessToken(tokenData.token);
      if (validation && validation.calendarId === tokenData.calendarId) {
        tokens.set(tokenData.calendarId, tokenData.permission);
      }
    }

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
      const share = shares.get(cal.id);
      const subscription = subscriptions.get(cal.id);
      const token = tokens.get(cal.id);

      // Determine subscription source
      let subscriptionSource: "guest" | "shared" | "token" | undefined =
        subscription?.source as "guest" | "shared" | undefined;
      if (token && !share && !subscription) {
        subscriptionSource = "token";
      }

      return {
        ...cal,
        sharePermission: share || undefined,
        tokenPermission: token || undefined,
        isSubscribed: !!subscription || !!token,
        subscriptionSource,
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
    const { name, color, guestPermission } = body;

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
        guestPermission: guestPermission || "none",
      })
      .returning();

    // Log calendar creation event
    if (user) {
      await logUserAction<CalendarCreatedMetadata>({
        action: "calendar.created",
        userId: user.id,
        resourceType: "calendar",
        resourceId: calendar.id,
        metadata: {
          calendarName: calendar.name,
          color: calendar.color,
        },
        request,
      });
    }

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    console.error("Failed to create calendar:", error);
    return NextResponse.json(
      { error: "Failed to create calendar" },
      { status: 500 }
    );
  }
}
