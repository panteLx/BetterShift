import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens } from "@/lib/db/schema";
import { rateLimit } from "@/lib/rate-limiter";
import { canReadFeed, findFeedToken } from "@/lib/calendar-feed";
import { buildIcsCalendar } from "@/lib/ics";
import { defaultLocale } from "@/lib/locales";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: rawToken } = await params;
    // Outlook and some other clients only subscribe to URLs ending in .ics
    const token = rawToken.replace(/\.ics$/i, "");

    const feedToken = await findFeedToken(token);
    if (!feedToken) return notFound();

    // Tokens minted with auth off have no user; key those on the token so the limit doesn't depend on the proxy's IP.
    const rateLimitResponse = rateLimit(
      request,
      feedToken.userId,
      "calendar-feed",
      feedToken.userId ? undefined : feedToken.id
    );
    if (rateLimitResponse) return rateLimitResponse;

    if (!(await canReadFeed(feedToken.userId, feedToken.calendarId))) return notFound();

    const calendar = await db.query.calendars.findFirst({
      where: (c, { eq }) => eq(c.id, feedToken.calendarId),
      columns: { id: true, name: true, splitShiftsEnabled: true },
    });
    if (!calendar) return notFound();

    void db
      .update(calendarFeedTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(calendarFeedTokens.id, feedToken.id))
      .catch((error) => console.error("Failed to record feed usage:", error));

    const ics = await buildIcsCalendar({ calendars: [calendar], locale: defaultLocale, feed: true });
    const filename = calendar.name.replace(/[^a-z0-9]/gi, "_").toLowerCase().substring(0, 40) || "calendar";

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${filename}.ics"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error serving calendar feed:", error);
    return NextResponse.json({ error: "Failed to build feed" }, { status: 500 });
  }
}
