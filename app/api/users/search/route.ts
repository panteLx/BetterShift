import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { or, and, eq, ne, sql } from "drizzle-orm";
import { member, user as userTable } from "@/lib/db/schema";
import { getRequestWorkspace } from "@/lib/workspace";
import { rateLimit } from "@/lib/rate-limiter";
import { MULTI_TENANT } from "@/lib/auth/env";

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
    const hasPermission = await hasCapability(
      currentUser.id,
      calendarId,
      "manageShares"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const workspace = await getRequestWorkspace();
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Search users by name or email (case-insensitive), members of this workspace only
    const pattern = `%${escapeLikePattern(query)}%`;
    const conditions = and(
      or(
        sql`${userTable.name} LIKE ${pattern} ESCAPE '\\'`,
        sql`${userTable.email} LIKE ${pattern} ESCAPE '\\'`
      ),
      ne(userTable.id, currentUser.id) // Exclude current user
    );
    const columns = {
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
    };
    // Single-tenant keeps the old unfiltered search: a missing member row must not hide a user.
    let users = MULTI_TENANT
      ? await db
          .select(columns)
          .from(userTable)
          .innerJoin(member, eq(member.userId, userTable.id))
          .where(and(eq(member.organizationId, workspace.id), conditions))
          .limit(10)
      : await db.select(columns).from(userTable).where(conditions).limit(10);

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
