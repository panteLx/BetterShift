import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/sessions";
import { checkPermission } from "@/lib/auth/permissions";
import { or, and, ne, sql } from "drizzle-orm";
import { user as userTable } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limiter";

// `%` and `_` are LIKE wildcards, and without escaping them a query such as
// "%%" passes the length check and turns into a match-all pattern that dumps
// the user directory. Backslash is escaped too because it is the escape
// character declared in the ESCAPE clause below.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser(request.headers);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResponse = rateLimit(request, currentUser.id, "user-search");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "calendarId is required" },
        { status: 400 }
      );
    }

    // Require a real search term so this endpoint cannot be used as a
    // directory dump of every account's name and email
    if (query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Only calendar admins/owners may search for users to share the calendar with
    const hasPermission = await checkPermission(
      currentUser.id,
      calendarId,
      "admin"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Search users by name or email (case-insensitive)
    const pattern = `%${escapeLikePattern(query)}%`;
    let users = await db.query.user.findMany({
      where: and(
        or(
          sql`${userTable.name} LIKE ${pattern} ESCAPE '\\'`,
          sql`${userTable.email} LIKE ${pattern} ESCAPE '\\'`
        ),
        ne(userTable.id, currentUser.id) // Exclude current user
      ),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      limit: 10,
    });

    // Exclude users who already have access to this calendar
    const existingShares = await db.query.calendarShares.findMany({
      where: (shares, { eq }) => eq(shares.calendarId, calendarId),
      columns: {
        userId: true,
      },
    });

    const sharedUserIds = new Set(existingShares.map((s) => s.userId));
    users = users.filter((u) => !sharedUserIds.has(u.id));

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to search users:", error);
    return NextResponse.json(
      { error: "Failed to search users" },
      { status: 500 }
    );
  }
}
