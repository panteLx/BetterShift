import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLogs, calendars } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calendarId = searchParams.get("calendarId");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!calendarId) {
    return NextResponse.json(
      { error: "Calendar ID is required" },
      { status: 400 }
    );
  }

  try {
    const user = await getSessionUser(request.headers);

    // Fetch calendar
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

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

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
    const user = await getSessionUser(request.headers);

    // Fetch calendar
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

    // Check write permission (if auth is enabled)
    if (user && !(await canEditCalendar(user.id, calendarId))) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

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
    const user = await getSessionUser(request.headers);

    // Fetch calendar
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

    // Check write permission (works for both authenticated users and guests)
    const hasWriteAccess = await canEditCalendar(user?.id, calendarId);
    if (!hasWriteAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

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
