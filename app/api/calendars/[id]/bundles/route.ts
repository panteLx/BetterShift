import { NextRequest, NextResponse } from "next/server";
import {
  createPermissionBundle,
  getCalendarName,
  listBundlesWithUsage,
  handleBundleServiceError,
  requireManageSharesOrGuestAccess,
} from "@/lib/auth/permission-bundles-service";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CalendarBundleCreatedMetadata } from "@/lib/audit-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const auth = await requireManageSharesOrGuestAccess(request, calendarId);
    if (auth instanceof NextResponse) return auth;

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
    const auth = await requireManageSharesOrGuestAccess(request, calendarId);
    if (auth instanceof NextResponse) return auth;

    const rateLimitResponse = rateLimit(
      request,
      auth.userId,
      "bundle-mutations",
      calendarId
    );
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { name, capabilities } = body;

    if (typeof name !== "string") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const bundle = await createPermissionBundle(
      calendarId,
      { name, capabilities },
      auth.access
    );

    await logUserAction<CalendarBundleCreatedMetadata>({
      userId: auth.userId,
      action: "calendar.bundle.created",
      request,
      metadata: {
        calendarName: await getCalendarName(calendarId),
        bundleName: bundle.name,
        capabilities: bundle.capabilities,
      },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (error) {
    return handleBundleServiceError(error, "Failed to create permission bundle");
  }
}
