import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLogs } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

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
