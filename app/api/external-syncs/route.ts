import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalSyncs, calendars } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { canViewCalendar, canEditCalendar } from "@/lib/auth/permissions";
import {
  isValidCalendarUrl,
  detectCalendarSyncType,
  isValidICSContent,
  type CalendarSyncType,
} from "@/lib/external-calendar-utils";
import { logUserAction, type SyncCreatedMetadata } from "@/lib/audit-log";

// GET all external syncs for a calendar
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    // Fetch calendar to verify it exists
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

    // Check view permissions (works for both authenticated users and guests)
    const user = await getSessionUser(request.headers);
    const hasAccess = await canViewCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Read access required." },
        { status: 403 }
      );
    }

    const syncs = await db
      .select()
      .from(externalSyncs)
      .where(eq(externalSyncs.calendarId, calendarId))
      .orderBy(desc(externalSyncs.createdAt));

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      calendarId,
      name,
      calendarUrl,
      color,
      displayMode,
      autoSyncInterval,
      icsContent, // For file uploads
      isHidden,
      hideFromStats,
    } = body;

    if (!calendarId || !name) {
      return NextResponse.json(
        {
          error: "Calendar ID and name are required",
        },
        { status: 400 }
      );
    }

    // Fetch calendar to verify it exists
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

    // Check edit permissions (works for both authenticated users and guests)
    const user = await getSessionUser(request.headers);
    const hasAccess = await canEditCalendar(user?.id, calendarId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Write access required." },
        { status: 403 }
      );
    }

    let finalCalendarUrl;
    let isOneTimeImport = false;
    let syncType: CalendarSyncType;

    // Handle different scenarios
    if (icsContent) {
      // Validate ICS content
      if (!isValidICSContent(icsContent)) {
        return NextResponse.json(
          { error: "Invalid ICS file format or file contains no events" },
          { status: 400 }
        );
      }

      // File upload - one-time import, always custom type
      isOneTimeImport = true;
      syncType = "custom";
      // Store content as data URL for later retrieval
      finalCalendarUrl = `data:text/calendar;base64,${Buffer.from(
        icsContent
      ).toString("base64")}`;
    } else if (calendarUrl) {
      // URL-based import - detect type from URL
      syncType = detectCalendarSyncType(calendarUrl);
      isOneTimeImport = false;

      // Validate calendar URL to prevent SSRF
      if (!isValidCalendarUrl(calendarUrl, syncType)) {
        const domainMsg =
          syncType === "icloud"
            ? "icloud.com domain"
            : syncType === "google"
            ? "google.com domain"
            : "valid domain";
        return NextResponse.json(
          {
            error: `Invalid ${syncType} calendar URL. URL must use webcal:// or https:// protocol and be from ${domainMsg}`,
          },
          { status: 400 }
        );
      }
      finalCalendarUrl = calendarUrl;
    } else {
      return NextResponse.json(
        { error: "Either calendar URL or ICS content is required" },
        { status: 400 }
      );
    }

    // Validate autoSyncInterval (should be 0 for one-time imports)
    const validIntervals = [0, 5, 15, 30, 60, 120, 360, 720, 1440];
    const finalAutoSyncInterval = isOneTimeImport ? 0 : autoSyncInterval || 0;
    if (
      finalAutoSyncInterval !== undefined &&
      !validIntervals.includes(finalAutoSyncInterval)
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
        calendarUrl: finalCalendarUrl,
        color: color || "#3b82f6",
        displayMode: displayMode || "normal",
        autoSyncInterval: finalAutoSyncInterval,
        isOneTimeImport,
        isHidden: isHidden || false,
        hideFromStats: hideFromStats || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Log external sync creation event
    if (user) {
      await logUserAction<SyncCreatedMetadata>({
        action: "sync.created",
        userId: user.id,
        resourceType: "sync",
        resourceId: externalSync.id,
        metadata: {
          calendarName: calendar.name,
          syncUrl: isOneTimeImport ? "file-upload" : finalCalendarUrl,
          syncName: externalSync.name,
        },
        request,
      });
    }

    return NextResponse.json(externalSync, { status: 201 });
  } catch (error) {
    console.error("Failed to create external sync:", error);
    return NextResponse.json(
      { error: "Failed to create external sync" },
      { status: 500 }
    );
  }
}
