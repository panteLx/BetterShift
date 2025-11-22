import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, shifts } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/lib/password-utils";

// GET all calendars
export async function GET() {
  try {
    const allCalendars = await db
      .select({
        id: calendars.id,
        name: calendars.name,
        color: calendars.color,
        passwordHash: calendars.passwordHash,
        createdAt: calendars.createdAt,
        updatedAt: calendars.updatedAt,
        _count:
          sql<number>`(SELECT COUNT(*) FROM ${shifts} WHERE ${shifts.calendarId} = ${calendars.id})`.as(
            "shift_count"
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
    const { name, color, password } = body;

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
        passwordHash: password ? hashPassword(password) : null,
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
