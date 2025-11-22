import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";

// POST verify calendar password
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check if calendar has a password
    if (!calendar.passwordHash) {
      return NextResponse.json({ valid: true, protected: false });
    }

    // If no password provided in request but calendar is protected
    if (!password) {
      return NextResponse.json({ valid: false, protected: true });
    }

    // Verify password
    const isValid = verifyPassword(password, calendar.passwordHash);

    return NextResponse.json({ valid: isValid, protected: true });
  } catch (error) {
    console.error("Failed to verify password:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
}
