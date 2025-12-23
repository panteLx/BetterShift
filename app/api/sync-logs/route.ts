import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLogs, calendars } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get("calendarId");
  const limit = parseInt(searchParams.get("limit") || "50");
  const password = searchParams.get("password");

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar ID is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // TEMP: Password checks disabled during auth migration (Phase 0-2)
    // Will be replaced with permission system in Phase 3

    const logs = await db
      .select()
      .from(syncLogs)
      .where(eq(syncLogs.calendarId, calendarId))
      .orderBy(desc(syncLogs.syncedAt))
      .limit(limit);

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching sync logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get("calendarId");
  const action = searchParams.get("action");

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar ID is required" },
      { status: 400 }
    );
  }

  try {
    // Read password from request body
    let password: string | null = null;
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      try {
        const body = await request.json();
        password = body.password || null;
      } catch {
        // If body parsing fails, continue with null password
      }
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // TEMP: Password checks disabled during auth migration (Phase 0-2)
    // Will be replaced with permission system in Phase 3

    if (action === "markErrorsAsRead") {
      // Mark all error logs as read for this calendar
      await db
        .update(syncLogs)
        .set({ isRead: true })
        .where(
          and(eq(syncLogs.calendarId, calendarId), eq(syncLogs.status, "error"))
        );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating sync logs:", error);
    return NextResponse.json(
      { error: "Failed to update sync logs" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get("calendarId");

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar ID is required" },
      { status: 400 }
    );
  }

  try {
    // Read password from request body
    let password: string | null = null;
    const contentType = request.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      try {
        const body = await request.json();
        password = body.password || null;
      } catch {
        // If body parsing fails, continue with null password
      }
    }

    // Fetch calendar to check password
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, calendarId));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // TEMP: Password checks disabled during auth migration (Phase 0-2)
    // Will be replaced with permission system in Phase 3

    await db.delete(syncLogs).where(eq(syncLogs.calendarId, calendarId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sync logs:", error);
    return NextResponse.json(
      { error: "Failed to delete sync logs" },
      { status: 500 }
    );
  }
}
