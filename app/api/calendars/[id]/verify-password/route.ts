import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

    // TEMP: Password checks disabled during auth migration (Phase 0-2)
    // Will be replaced with permission system in Phase 3
    return NextResponse.json({ valid: true, protected: false });
  } catch (error) {
    console.error("Failed to verify password:", error);
    return NextResponse.json(
      { error: "Failed to verify password" },
      { status: 500 }
    );
  }
}
