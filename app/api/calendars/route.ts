import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// GET all calendars
export async function GET() {
  try {
    const allCalendars = await db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        ownerId: calendars.ownerId,
        createdAt: calendars.createdAt,
        updatedAt: calendars.updatedAt,
        _count:
          sql<number>`(SELECT COUNT(*) FROM ${shifts} WHERE ${shifts.calendarId} = ${calendars.id})`.as(
            "_count"
          ),
      })
      .from(calendars)
      .orderBy(calendars.createdAt);

    return NextResponse.json(allCalendars);
  } catch (error) {
    console.error("Failed to fetch calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendars" },
      { status: 500 }
    );
  }
}

// POST create new calendar
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Calendar name is required" },
        { status: 400 }
      );
    }

    // TEMP: Password/lock logic removed during auth migration (Phase 0-2)
    // Will be replaced with owner assignment in Phase 3

    const [calendar] = await db
      .insert(calendars)
      .values({
        name,
        color: color || "#3b82f6",
        ownerId: null, // Will be set to current user in Phase 3
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
