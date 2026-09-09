import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limiter";

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
    const rateLimitResponse = rateLimit(request, null, "ban-info");
    if (rateLimitResponse) return rateLimitResponse;

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

    // Respond identically whether the account does not exist or exists but
    // is not banned, so this endpoint cannot be used to enumerate accounts.
    if (!user || !user.banned) {
      return NextResponse.json(
        { error: "No ban information available" },
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
