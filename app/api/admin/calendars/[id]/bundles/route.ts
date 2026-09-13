import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, siteAdminCanEditCalendar } from "@/lib/auth/admin";
import {
  getValidatedAdminUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";
import { listBundlesWithUsage } from "@/lib/auth/permission-bundles-service";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/admin/calendars/[id]/bundles
 *
 * Lists a calendar's permission bundles for the admin panel's guest-access
 * picker (Paket 6 of .LOCAL/calendar-permission-bundles-plan.md). Read-only —
 * bundle content editing stays exclusive to the owner-facing panel, so this
 * is gated on site-admin edit rights rather than the owner-facing
 * `manageShares` capability, which a site admin managing someone else's
 * calendar generally won't have.
 *
 * Permission: Admin or Superadmin only
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: calendarId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    if (!siteAdminCanEditCalendar(currentUser)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const bundles = await listBundlesWithUsage(calendarId);
    return NextResponse.json(bundles);
  } catch (error) {
    console.error("[Admin Calendar Bundles API] Error:", error);

    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch permission bundles" },
      { status: 500 }
    );
  }
}
