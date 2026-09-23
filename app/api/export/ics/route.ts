import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { formatDateToLocal } from "@/lib/date-utils";
import { rateLimit } from "@/lib/rate-limiter";
import { buildIcsCalendar } from "@/lib/ics";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);

    // Rate limiting: 20 ICS exports per 10 minutes
    const rateLimitResponse = rateLimit(request, user?.id, "export-ics");
    if (rateLimitResponse) return rateLimitResponse;

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || "en";

    const { calendarIds } = await request.json();

    if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
      return NextResponse.json(
        { error: "No calendar IDs provided" },
        { status: 400 }
      );
    }

    // Get all requested calendars
    const requestedCalendars = await db.query.calendars.findMany({
      where: inArray(calendars.id, calendarIds),
    });

    if (requestedCalendars.length === 0) {
      return NextResponse.json(
        { error: "No calendars found" },
        { status: 404 }
      );
    }

    // Filter calendars by permission - only include calendars user can view
    const accessFlags = await Promise.all(
      requestedCalendars.map((calendar) =>
        hasCapability(user?.id, calendar.id, "viewShifts")
      )
    );
    const accessibleCalendars = requestedCalendars.filter(
      (_, i) => accessFlags[i]
    );

    if (accessibleCalendars.length === 0) {
      return NextResponse.json(
        { error: "Insufficient permissions for selected calendars" },
        { status: 403 }
      );
    }

    // Generate ICS content
    const icsContent = await buildIcsCalendar({ calendars: accessibleCalendars, locale });

    // Create filename from calendar names (truncated)
    const calendarNamesParts = accessibleCalendars
      .map((c) =>
        c.name
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()
          .substring(0, 20)
      )
      .slice(0, 3); // Max 3 calendar names

    const filename = `${calendarNamesParts.join("_")}_${
      formatDateToLocal(new Date())
    }.ics`;

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting calendars as ICS:", error);
    return NextResponse.json(
      { error: "Failed to export calendars" },
      { status: 500 }
    );
  }
}
