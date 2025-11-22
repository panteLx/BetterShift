import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shiftPresets, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH update a preset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, startTime, endTime, color, notes, isSecondary, isAllDay } =
      body;

    const [updatedPreset] = await db
      .update(shiftPresets)
      .set({
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color,
        notes: notes || null,
        isSecondary: isSecondary !== undefined ? isSecondary : undefined,
        isAllDay: isAllDay !== undefined ? isAllDay : undefined,
        updatedAt: new Date(),
      })
      .where(eq(shiftPresets.id, id))
      .returning();

    // Update all shifts that were created from this preset
    await db
      .update(shifts)
      .set({
        title,
        startTime: isAllDay ? "00:00" : startTime,
        endTime: isAllDay ? "23:59" : endTime,
        color,
        notes: notes || null,
        isAllDay: isAllDay !== undefined ? isAllDay : undefined,
        updatedAt: new Date(),
      })
      .where(eq(shifts.presetId, id));

    return NextResponse.json(updatedPreset);
  } catch (error) {
    console.error("Error updating preset:", error);
    return NextResponse.json(
      { error: "Failed to update preset" },
      { status: 500 }
    );
  }
}

// DELETE a preset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Delete all shifts that were created from this preset
    await db.delete(shifts).where(eq(shifts.presetId, id));

    // Delete the preset
    await db.delete(shiftPresets).where(eq(shiftPresets.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting preset:", error);
    return NextResponse.json(
      { error: "Failed to delete preset" },
      { status: 500 }
    );
  }
}
