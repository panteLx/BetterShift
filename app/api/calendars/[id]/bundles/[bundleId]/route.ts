import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import {
  deletePermissionBundle,
  getBundleForCalendar,
  updatePermissionBundle,
  PermissionBundleServiceError,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import {
  logUserAction,
  type CalendarBundleUpdatedMetadata,
  type CalendarBundleDeletedMetadata,
} from "@/lib/audit-log";

async function requireManageShares(
  request: NextRequest,
  calendarId: string
): Promise<{ userId: string } | NextResponse> {
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
  return { userId: user.id };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bundleId: string }> }
) {
  try {
    const { id: calendarId, bundleId } = await params;
    const auth = await requireManageShares(request, calendarId);
    if (auth instanceof NextResponse) return auth;

    const rateLimitResponse = rateLimit(
      request,
      auth.userId,
      "bundle-mutations",
      calendarId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const existing = await getBundleForCalendar(calendarId, bundleId);
    if (!existing) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, capabilities } = body;

    if (name !== undefined && typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const updated = await updatePermissionBundle(calendarId, bundleId, {
      name,
      capabilities,
    });

    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    const before = new Set(existing.capabilities);
    const after = new Set(updated.capabilities);
    const addedCapabilities = updated.capabilities.filter((c) => !before.has(c));
    const removedCapabilities = existing.capabilities.filter(
      (c) => !after.has(c)
    );

    await logUserAction<CalendarBundleUpdatedMetadata>({
      userId: auth.userId,
      action: "calendar.bundle.updated",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        bundleName: updated.name,
        addedCapabilities,
        removedCapabilities,
        ...(updated.name !== existing.name
          ? { renamed: { from: existing.name, to: updated.name } }
          : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof PermissionBundleServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }
    console.error("Failed to update permission bundle:", error);
    return NextResponse.json(
      { error: "Failed to update permission bundle" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bundleId: string }> }
) {
  try {
    const { id: calendarId, bundleId } = await params;
    const auth = await requireManageShares(request, calendarId);
    if (auth instanceof NextResponse) return auth;

    const rateLimitResponse = rateLimit(
      request,
      auth.userId,
      "bundle-mutations",
      calendarId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const existing = await getBundleForCalendar(calendarId, bundleId);
    if (!existing) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    await deletePermissionBundle(calendarId, bundleId);

    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    await logUserAction<CalendarBundleDeletedMetadata>({
      userId: auth.userId,
      action: "calendar.bundle.deleted",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        bundleName: existing.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PermissionBundleServiceError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }
    console.error("Failed to delete permission bundle:", error);
    return NextResponse.json(
      { error: "Failed to delete permission bundle" },
      { status: 500 }
    );
  }
}
