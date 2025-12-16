import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password-utils";
import { eventEmitter, CalendarChangeEvent } from "@/lib/event-emitter";

// PATCH reorder presets
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendarId, presetOrders, password } = body;

    if (!calendarId || !presetOrders || !Array.isArray(presetOrders)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    // Verify password if calendar is protected
    if (calendar.passwordHash) {
      if (!password || !verifyPassword(password, calendar.passwordHash)) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // Update order for each preset
    // presetOrders format: [{ id: string, order: number }]
    for (const { id, order } of presetOrders) {
      await db
        .update(shiftPresets)
        .set({ order, updatedAt: new Date() })
        .where(eq(shiftPresets.id, id));
    }

    // Emit event for SSE
    eventEmitter.emit("calendar-change", {
      type: "preset",
      action: "update",
      calendarId,
      data: { presetOrders },
    } as CalendarChangeEvent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering presets:", error);
    return NextResponse.json(
      { error: "Failed to reorder presets" },
      { status: 500 }
    );
  }
}
