import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Public API to get ban information for a banned user
 *
 * POST /api/auth/ban-info
 * Body: { email: string }
 *
 * Returns ban details if user is banned, otherwise returns 404.
 * This is a public endpoint to show ban info on login page.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by email
    const [user] = await db
      .select({
        banned: userTable.banned,
        banReason: userTable.banReason,
        banExpires: userTable.banExpires,
      })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.banned) {
      return NextResponse.json(
        { error: "User is not banned" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      banned: true,
      banReason: user.banReason,
      banExpires: user.banExpires,
    });
  } catch (error) {
    console.error("Failed to fetch ban info:", error);
    return NextResponse.json(
      { error: "Failed to fetch ban info" },
      { status: 500 }
    );
  }
}
