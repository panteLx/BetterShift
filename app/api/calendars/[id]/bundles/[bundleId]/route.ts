import { NextRequest, NextResponse } from "next/server";
import {
  deletePermissionBundle,
  getBundleForCalendar,
  getCalendarName,
  updatePermissionBundle,
  handleBundleServiceError,
  requireManageSharesOrGuestAccess,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import {
  logUserAction,
  type CalendarBundleUpdatedMetadata,
  type CalendarBundleDeletedMetadata,
} from "@/lib/audit-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bundleId: string }> }
) {
  try {
    const { id: calendarId, bundleId } = await params;
    const auth = await requireManageSharesOrGuestAccess(request, calendarId);
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

    const updated = await updatePermissionBundle(
      calendarId,
      bundleId,
      { name, capabilities },
      auth.access
    );

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
        calendarName: await getCalendarName(calendarId),
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
    return handleBundleServiceError(error, "Failed to update permission bundle");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bundleId: string }> }
) {
  try {
    const { id: calendarId, bundleId } = await params;
    const auth = await requireManageSharesOrGuestAccess(request, calendarId);
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

    await logUserAction<CalendarBundleDeletedMetadata>({
      userId: auth.userId,
      action: "calendar.bundle.deleted",
      request,
      metadata: {
        calendarName: await getCalendarName(calendarId),
        bundleName: existing.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleBundleServiceError(error, "Failed to delete permission bundle");
  }
}
