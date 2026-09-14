import { NextRequest, NextResponse } from "next/server";
import {
  clonePermissionBundle,
  getBundleForCalendar,
  getCalendarName,
  handleBundleServiceError,
  requireManageShares,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarBundleClonedMetadata } from "@/lib/audit-log";

export async function POST(
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

    await logUserAction<CalendarBundleClonedMetadata>({
      userId: auth.userId,
      action: "calendar.bundle.cloned",
      request,
      metadata: {
        calendarName: await getCalendarName(calendarId),
        sourceBundleName: source.name,
        newBundleName: clone.name,
      },
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    return handleBundleServiceError(error, "Failed to clone permission bundle");
  }
}
