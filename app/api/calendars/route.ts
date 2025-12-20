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
        isLocked: calendars.isLocked,
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
    const { name, color, password, isLocked } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Calendar name is required" },
        { status: 400 }
      );
    }

    // Can't lock without password
    if (isLocked && !password) {
      return NextResponse.json(
        { error: "Cannot lock calendar without password" },
        { status: 400 }
      );
    }

    const [calendar] = await db
      .insert(calendars)
      .values({
        name,
        color: color || "#3b82f6",
        passwordHash: password ? hashPassword(password) : null,
        isLocked: isLocked || false,
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
