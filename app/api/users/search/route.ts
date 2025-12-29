import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/sessions";
import { like, or, and, ne } from "drizzle-orm";
import { user as userTable } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getSessionUser(request.headers);

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "calendarId is required" },
        { status: 400 }
      );
    }

    // Search users by name or email (case-insensitive)
    let users = await db.query.user.findMany({
      where: and(
        or(
          like(userTable.name, `%${query}%`),
          like(userTable.email, `%${query}%`)
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
