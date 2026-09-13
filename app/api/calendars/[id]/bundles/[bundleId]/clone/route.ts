import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import {
  clonePermissionBundle,
  getBundleForCalendar,
  PermissionBundleServiceError,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarBundleClonedMetadata } from "@/lib/audit-log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bundleId: string }> }
) {
  try {
    const { id: calendarId, bundleId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPermission = await hasCapability(
      user.id,
      calendarId,
      "manageShares"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const rateLimitResponse = rateLimit(
      request,
      user.id,
      "bundle-mutations",
      calendarId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const source = await getBundleForCalendar(calendarId, bundleId);
    if (!source) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name } = body;
    if (typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const clone = await clonePermissionBundle(calendarId, bundleId, name);

    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    await logUserAction<CalendarBundleClonedMetadata>({
      userId: user.id,
      action: "calendar.bundle.cloned",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        sourceBundleName: source.name,
        newBundleName: clone.name,
      },
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionBundleServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }
    console.error("Failed to clone permission bundle:", error);
    return NextResponse.json(
      { error: "Failed to clone permission bundle" },
      { status: 500 }
    );
  }
}
