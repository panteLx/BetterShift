import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar } from "@/lib/auth/permissions";
import { addShiftSignup, getShiftOrNull, getShiftSignupUsers } from "@/lib/shift-signups";

// GET all signups for a shift
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shiftId } = await params;
    const user = await getSessionUser(request.headers);

    const shift = await getShiftOrNull(shiftId);
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const hasAccess = await canViewCalendar(user?.id, shift.calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const signups = await getShiftSignupUsers(shiftId);
    return NextResponse.json(signups);
  } catch (error) {
    console.error("Failed to fetch shift signups:", error);
    return NextResponse.json(
      { error: "Failed to fetch shift signups" },
      { status: 500 }
    );
  }
}

// POST sign a user up for a shift. Omitting userId signs the caller up.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shiftId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shift = await getShiftOrNull(shiftId);
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId: string = body.userId || user.id;

    const existing = await getShiftSignupUsers(shiftId);
    const existingIds = new Set(existing.map((s) => s.id));

    const result = await addShiftSignup(
      shiftId,
      shift.calendarId,
      user.id,
      targetUserId,
      existingIds,
      shift.signupCapacity
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const signups = await getShiftSignupUsers(shiftId);
    return NextResponse.json(signups, { status: 201 });
  } catch (error) {
    console.error("Failed to create shift signup:", error);
    return NextResponse.json(
      { error: "Failed to create shift signup" },
      { status: 500 }
    );
  }
}
