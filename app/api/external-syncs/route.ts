import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalSyncs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  isValidCalendarUrl,
  type CalendarSyncType,
} from "@/lib/external-calendar-utils";

// GET all external syncs for a calendar
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    const syncs = await db
      .select()
      .from(externalSyncs)
      .where(eq(externalSyncs.calendarId, calendarId))
      .orderBy(externalSyncs.createdAt);

    return NextResponse.json(syncs);
  } catch (error) {
    console.error("Failed to fetch external syncs:", error);
    return NextResponse.json(
      { error: "Failed to fetch external syncs" },
      { status: 500 }
    );
  }
}

// POST create new external sync
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      calendarId,
      name,
      syncType,
      calendarUrl,
      color,
      displayMode,
      autoSyncInterval,
    } = body;

    if (!calendarId || !name || !calendarUrl || !syncType) {
      return NextResponse.json(
        {
          error: "Calendar ID, name, sync type, and calendar URL are required",
        },
        { status: 400 }
      );
    }

    // Validate sync type
    if (!["icloud", "google"].includes(syncType)) {
      return NextResponse.json(
        { error: "Sync type must be either 'icloud' or 'google'" },
        { status: 400 }
      );
    }

    // Validate calendar URL to prevent SSRF
    if (!isValidCalendarUrl(calendarUrl, syncType as CalendarSyncType)) {
      const domain = syncType === "icloud" ? "icloud.com" : "google.com";
      return NextResponse.json(
        {
          error: `Invalid ${syncType} calendar URL. URL must use webcal:// or https:// protocol and be from ${domain} domain`,
        },
        { status: 400 }
      );
    }

    // Validate autoSyncInterval
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

    const [externalSync] = await db
      .insert(externalSyncs)
      .values({
        id: crypto.randomUUID(),
        calendarId,
        name,
        syncType,
        calendarUrl,
        color: color || "#3b82f6",
        displayMode: displayMode || "normal",
        autoSyncInterval: autoSyncInterval || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(externalSync, { status: 201 });
  } catch (error) {
    console.error("Failed to create external sync:", error);
    return NextResponse.json(
      { error: "Failed to create external sync" },
      { status: 500 }
    );
  }
}
