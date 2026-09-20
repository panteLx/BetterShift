import { NextRequest, NextResponse } from "next/server";
import {
  ANNOUNCEMENT_PLACEMENTS,
  getVisibleAnnouncements,
  type AnnouncementPlacement,
} from "@/lib/announcements";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * Public Announcements API
 *
 * GET /api/announcements?placement=auth|dashboard
 *
 * No session required -- the auth pages call it while logged out. Returns only
 * announcements visible right now; the browser never decides visibility.
 */
export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimit(request, null, "announcements");
  if (rateLimitResponse) return rateLimitResponse;

  const placement = request.nextUrl.searchParams.get("placement");
  if (!ANNOUNCEMENT_PLACEMENTS.includes(placement as AnnouncementPlacement)) {
    return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
  }

  try {
    const announcements = await getVisibleAnnouncements(placement as AnnouncementPlacement);
    return NextResponse.json({ announcements });
  } catch (error) {
    console.error("Failed to load announcements:", error);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}
