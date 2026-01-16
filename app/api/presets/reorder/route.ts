import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { canEditCalendar } from "@/lib/auth/permissions";

// PATCH reorder presets
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendarId, presetOrders } = body;

    if (!calendarId || !presetOrders || !Array.isArray(presetOrders)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate presetOrders contents
    const isValidPresetOrders = presetOrders.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.order === "number" &&
        Number.isFinite(item.order)
    );
    if (!isValidPresetOrders) {
      return NextResponse.json(
        { error: "Invalid presetOrders format" },
        { status: 400 }
      );
    }

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

    // Check edit permission (works for both authenticated users and guests)
    const hasAccess = await canEditCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify all preset IDs belong to the specified calendarId
    const presetIds = presetOrders.map(
      (p: { id: string; order: number }) => p.id
    );
    const existingPresets = await db
      .select({ id: shiftPresets.id })
      .from(shiftPresets)
      .where(eq(shiftPresets.calendarId, calendarId));

    const existingPresetIds = new Set(existingPresets.map((p) => p.id));
    const invalidIds = presetIds.filter(
      (id: string) => !existingPresetIds.has(id)
    );

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid preset IDs for this calendar" },
        { status: 403 }
      );
    }

    // Update order for each preset atomically in a transaction
    // presetOrders format: [{ id: string, order: number }]
    const updatePromises = presetOrders.map(
      ({ id, order }: { id: string; order: number }) =>
        db
          .update(shiftPresets)
          .set({ order, updatedAt: new Date() })
          .where(eq(shiftPresets.id, id))
    );
    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering presets:", error);
    return NextResponse.json(
      { error: "Failed to reorder presets" },
      { status: 500 }
    );
  }
}
