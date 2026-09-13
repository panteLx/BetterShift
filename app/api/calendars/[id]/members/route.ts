import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { canEditCalendar, getCalendarMembers } from "@/lib/auth/permissions";

// GET minimal member list (owner + shares) for a calendar.
// Used to pick who to add to a shift's signup list — deliberately narrower
// than /api/users/search, which is an admin-only global directory lookup.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    const hasAccess = await canEditCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

    const members = await getCalendarMembers(calendarId);

    if (!members) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch calendar members:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar members" },
      { status: 500 }
    );
  }
}
