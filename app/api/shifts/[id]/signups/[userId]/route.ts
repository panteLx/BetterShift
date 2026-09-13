import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftSignups } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { getShiftSignupPermission } from "@/lib/auth/permissions";
import { canActOnSignup, getShiftOrNull } from "@/lib/shift-signups";

// DELETE withdraw a user from a shift's signup list
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: shiftId, userId: targetUserId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shift = await getShiftOrNull(shiftId);
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const permission = await getShiftSignupPermission(
      user.id,
      shift.calendarId
    );
    if (!canActOnSignup(permission, user.id, targetUserId)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    await db
      .delete(shiftSignups)
      .where(
        and(
          eq(shiftSignups.shiftId, shiftId),
          eq(shiftSignups.userId, targetUserId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove shift signup:", error);
    return NextResponse.json(
      { error: "Failed to remove shift signup" },
      { status: 500 }
    );
  }
}
