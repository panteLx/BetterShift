import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  shifts,
  calendarShares,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { sql, eq, or, and } from "drizzle-orm";
import {
  getUserAccessibleCalendars,
  getShiftSignupPermission,
  seedPermissionBundles,
} from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/sessions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarCreatedMetadata } from "@/lib/audit-log";
import {
  getTokensFromCookie,
  validateAccessToken,
} from "@/lib/auth/token-auth";
import {
  coarseLevelFromCapabilities,
  findSeededGuestBundleId,
} from "@/lib/auth/legacy-permission-compat";
import {
  defaultBundleDefinitionsForNewCalendar,
  sanitizeCapabilities,
} from "@/lib/permission-bundles";

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
        guestBundleId: calendars.guestBundleId,
        signupsEnabled: calendars.signupsEnabled,
        viewSettings: calendars.viewSettings,
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
    let shares: Map<string, string> = new Map(); // calendarId -> bundleId

    // Get token bundles (works for both guests and authenticated users)
    const tokens: Map<string, string> = new Map(); // calendarId -> bundleId
    const userTokens = await getTokensFromCookie();
    for (const tokenData of userTokens) {
      // Validate token is still valid — use the freshly validated bundle,
      // not the cookie's own (possibly stale) copy
      const validation = await validateAccessToken(tokenData.token);
      if (validation && validation.calendarId === tokenData.calendarId) {
        tokens.set(tokenData.calendarId, validation.bundleId);
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
      shares = new Map(userShares.map((s) => [s.calendarId, s.bundleId]));
    }

    // Batch-resolve every bundle involved (guest, share, token) to its
    // capabilities so the legacy read/write/admin fields below stay a plain
    // in-memory lookup — see lib/auth/legacy-permission-compat.ts.
    const bundleIds = new Set<string>();
    for (const cal of userCalendars) {
      if (cal.guestBundleId) bundleIds.add(cal.guestBundleId);
    }
    for (const bundleId of shares.values()) bundleIds.add(bundleId);
    for (const bundleId of tokens.values()) bundleIds.add(bundleId);
    const bundleRows =
      bundleIds.size > 0
        ? await db.query.calendarPermissionBundles.findMany({
            where: (b, { inArray }) => inArray(b.id, Array.from(bundleIds)),
            columns: { id: true, capabilities: true },
          })
        : [];
    const capabilitiesByBundleId = new Map(
      bundleRows.map((row) => [row.id, sanitizeCapabilities(row.capabilities)])
    );

    // Enrich calendars with permission metadata
    const enrichedCalendars = await Promise.all(
      userCalendars.map(async (cal) => {
        const shareBundleId = shares.get(cal.id);
        const subscription = subscriptions.get(cal.id);
        const tokenBundleId = tokens.get(cal.id);

        // Determine subscription source
        let subscriptionSource: "guest" | "shared" | "token" | undefined =
          subscription?.source as "guest" | "shared" | undefined;
        if (tokenBundleId && !shareBundleId && !subscription) {
          subscriptionSource = "token";
        }

        const signupPermission = await getShiftSignupPermission(
          user?.id,
          cal.id
        );

        return {
          ...cal,
          guestPermission: cal.guestBundleId
            ? coarseLevelFromCapabilities(
                capabilitiesByBundleId.get(cal.guestBundleId) ?? []
              )
            : "none",
          sharePermission: shareBundleId
            ? coarseLevelFromCapabilities(
                capabilitiesByBundleId.get(shareBundleId) ?? []
              )
            : undefined,
          tokenPermission: tokenBundleId
            ? coarseLevelFromCapabilities(
                capabilitiesByBundleId.get(tokenBundleId) ?? []
              )
            : undefined,
          canSignUpSelf: signupPermission.canManageOwn,
          canSignUpOthers: signupPermission.canManageOthers,
          isSubscribed: !!subscription || !!tokenBundleId,
          subscriptionSource,
        };
      })
    );

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

    // Insert and bundle-seeding happen atomically: a calendar must never
    // exist even briefly without its four recommended bundles, since every
    // permission check assumes they're already there. better-sqlite3
    // transactions must be synchronous (no async/await inside), see
    // seedPermissionBundles().
    const calendar = db.transaction((tx) => {
      const calendar = tx
        .insert(calendars)
        .values({
          name,
          color: color || "#3b82f6",
          ownerId: user?.id || null, // Set current user as owner (or null if auth disabled)
        })
        .returning()
        .get();

      // Every calendar always ships with the four recommended bundles, so
      // it's never "configured from nothing" — see lib/permission-bundles.ts.
      seedPermissionBundles(
        calendar.id,
        defaultBundleDefinitionsForNewCalendar(),
        tx
      );

      return calendar;
    });

    if (guestPermission && guestPermission !== "none") {
      const guestBundleId = await findSeededGuestBundleId(
        calendar.id,
        guestPermission
      );
      if (guestBundleId) {
        await db
          .update(calendars)
          .set({ guestBundleId })
          .where(eq(calendars.id, calendar.id));
        calendar.guestBundleId = guestBundleId;
      }
    }

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
