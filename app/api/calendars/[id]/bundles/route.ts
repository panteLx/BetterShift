import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import {
  createPermissionBundle,
  listBundlesWithUsage,
  PermissionBundleServiceError,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarBundleCreatedMetadata } from "@/lib/audit-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    const hasPermission = await hasCapability(
      user?.id,
      calendarId,
      "manageShares"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const bundles = await listBundlesWithUsage(calendarId);
    return NextResponse.json(bundles);
  } catch (error) {
    console.error("Failed to fetch permission bundles:", error);
    return NextResponse.json(
      { error: "Failed to fetch permission bundles" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
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

    const body = await request.json();
    const { name, capabilities } = body;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const bundle = await createPermissionBundle(calendarId, {
      name,
      capabilities,
    });

    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    await logUserAction<CalendarBundleCreatedMetadata>({
      userId: user.id,
      action: "calendar.bundle.created",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        bundleName: bundle.name,
        capabilities: bundle.capabilities,
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    if (error instanceof PermissionBundleServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }
    console.error("Failed to create permission bundle:", error);
    return NextResponse.json(
      { error: "Failed to create permission bundle" },
      { status: 500 }
    );
  }
}
