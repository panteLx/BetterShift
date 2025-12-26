import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { sql, eq, or } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/session";
import { getUserAccessibleCalendars } from "@/lib/auth/permissions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";

// GET all calendars (only those accessible to the user)
export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request.headers);

    // Get accessible calendar IDs (handles auth-disabled, guest, and authenticated users)
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

    return NextResponse.json(userCalendars);
  } catch (error) {
    console.error("Failed to fetch calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

// POST create new calendar (sets current user as owner)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request.headers);

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
