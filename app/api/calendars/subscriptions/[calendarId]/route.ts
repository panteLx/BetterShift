import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { dismissCalendar } from "@/lib/auth/permissions";

/**
 * DELETE /api/calendars/subscriptions/[calendarId]
 * Dismiss/unsubscribe from a calendar
 * - For shared calendars: creates dismissal entry
 * - For subscribed calendars: removes subscription
 * - Cannot dismiss owned calendars
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const user = await getSessionUser(request.headers);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { calendarId } = await params;

    // Use the helper function to handle dismissal/unsubscribe
    await dismissCalendar(user.id, calendarId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error dismissing calendar:", error);
    const message =
      error instanceof Error ? error.message : "Failed to dismiss calendar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
