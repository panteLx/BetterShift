import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalSyncs, shifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { eventEmitter } from "@/lib/event-emitter";
import {
  isValidCalendarUrl,
  type CalendarSyncType,
} from "@/lib/external-calendar-utils";

// GET single external sync
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [externalSync] = await db
      .select()
      .from(externalSyncs)
      .where(eq(externalSyncs.id, id))
      .limit(1);

    if (!externalSync) {
      return NextResponse.json(
        { error: "External sync not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(externalSync);
  } catch (error) {
    console.error("Failed to fetch external sync:", error);
    return NextResponse.json(
      { error: "Failed to fetch external sync" },
      { status: 500 }
    );
  }
}

// PATCH update external sync
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      calendarUrl,
      color,
      displayMode,
      isHidden,
      hideFromStats,
      autoSyncInterval,
    } = body;

    // Get existing sync to validate URL with correct sync type
    const [existingSync] = await db
      .select()
      .from(externalSyncs)
      .where(eq(externalSyncs.id, id))
      .limit(1);

    if (!existingSync) {
      return NextResponse.json(
        { error: "External sync not found" },
        { status: 404 }
      );
    }

    // Validate calendar URL if provided
    if (calendarUrl !== undefined) {
      if (
        !isValidCalendarUrl(
          calendarUrl,
          existingSync.syncType as CalendarSyncType
        )
      ) {
        const domain =
          existingSync.syncType === "icloud" ? "icloud.com" : "google.com";
        return NextResponse.json(
          {
            error: `Invalid ${existingSync.syncType} calendar URL. URL must use webcal:// or https:// protocol and be from ${domain} domain`,
          },
          { status: 400 }
        );
      }
    }

    // Validate autoSyncInterval if provided
    const validIntervals = [0, 5, 15, 30, 60, 120, 360, 720, 1440];
    if (
      autoSyncInterval !== undefined &&
      !validIntervals.includes(autoSyncInterval)
    ) {
      return NextResponse.json(
        {
          error: `Invalid auto-sync interval. Must be one of: ${validIntervals.join(
            ", "
          )} minutes`,
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (calendarUrl !== undefined) updateData.calendarUrl = calendarUrl;
    if (color !== undefined) updateData.color = color;
    if (displayMode !== undefined) updateData.displayMode = displayMode;
    if (isHidden !== undefined) updateData.isHidden = isHidden;
    if (hideFromStats !== undefined) updateData.hideFromStats = hideFromStats;
    if (autoSyncInterval !== undefined)
      updateData.autoSyncInterval = autoSyncInterval;

    const [updated] = await db
      .update(externalSyncs)
      .set(updateData)
      .where(eq(externalSyncs.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "External sync not found" },
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
        .where(eq(shifts.externalSyncId, id));

      // Emit event to notify clients about shift updates
      eventEmitter.emit("calendar-change", {
        type: "shift",
        action: "update",
        calendarId: updated.calendarId,
        data: { externalSyncId: id, colorUpdated: true },
      });
    }

    // Emit event to notify clients about visibility changes
    if (isHidden !== undefined || hideFromStats !== undefined) {
      eventEmitter.emit("calendar-change", {
        type: "shift",
        action: "update",
        calendarId: updated.calendarId,
        data: { externalSyncId: id, visibilityUpdated: true },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update external sync:", error);
    return NextResponse.json(
      { error: "Failed to update external sync" },
      { status: 500 }
    );
  }
}

// DELETE external sync and all associated shifts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.delete(externalSyncs).where(eq(externalSyncs.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete external sync:", error);
    return NextResponse.json(
      { error: "Failed to delete external sync" },
      { status: 500 }
    );
  }
}
