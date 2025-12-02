import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { icloudSyncs, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventEmitter } from "@/lib/event-emitter";
import { isValidICloudUrl } from "@/lib/icloud-utils";

// GET single iCloud sync
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [icloudSync] = await db
      .select()
      .from(icloudSyncs)
      .where(eq(icloudSyncs.id, id))
      .limit(1);

    if (!icloudSync) {
      return NextResponse.json(
        { error: "iCloud sync not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(icloudSync);
  } catch (error) {
    console.error("Failed to fetch iCloud sync:", error);
    return NextResponse.json(
      { error: "Failed to fetch iCloud sync" },
      { status: 500 }
    );
  }
}

// PATCH update iCloud sync
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, icloudUrl, color } = body;

    // Validate iCloud URL if provided
    if (icloudUrl !== undefined && !isValidICloudUrl(icloudUrl)) {
      return NextResponse.json(
        {
          error:
            "Invalid iCloud URL. URL must use webcal:// or https:// protocol and be from icloud.com domain",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (icloudUrl !== undefined) updateData.icloudUrl = icloudUrl;
    if (color !== undefined) updateData.color = color;

    const [updated] = await db
      .update(icloudSyncs)
      .set(updateData)
      .where(eq(icloudSyncs.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "iCloud sync not found" },
        { status: 404 }
      );
    }

    // If color was updated, also update the color of all associated shifts
    if (color !== undefined) {
      await db
        .update(shifts)
        .set({
          color: color,
          updatedAt: new Date(),
        })
        .where(eq(shifts.icloudSyncId, id));

      // Emit event to notify clients about shift updates
      eventEmitter.emit("calendar-change", {
        type: "shift",
        action: "update",
        calendarId: updated.calendarId,
        data: { icloudSyncId: id, colorUpdated: true },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update iCloud sync:", error);
    return NextResponse.json(
      { error: "Failed to update iCloud sync" },
      { status: 500 }
    );
  }
}

// DELETE iCloud sync and all associated shifts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.delete(icloudSyncs).where(eq(icloudSyncs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete iCloud sync:", error);
    return NextResponse.json(
      { error: "Failed to delete iCloud sync" },
      { status: 500 }
    );
  }
}
