import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens, calendars } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { generateAccessToken } from "@/lib/auth/token-auth";
import { logUserAction, type CalendarFeedTokenMetadata } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import { canReadFeed, feedOwnerCondition, getFeedToken } from "@/lib/calendar-feed";

type Params = { params: Promise<{ id: string }> };

// Feeds are bound to an account, so guests get nothing; with auth off the single owner is null.
async function resolveFeedOwner(
  request: NextRequest,
  calendarId: string
): Promise<{ userId: string | null } | NextResponse> {
  const user = await getSessionUser(request.headers);
  if (isAuthEnabled() && !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = user?.id ?? null;
  if (!(await canReadFeed(userId, calendarId))) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return { userId };
}

function toResponse(row: { token: string; createdAt: Date; lastUsedAt: Date | null } | null) {
  return {
    token: row?.token ?? null,
    createdAt: row?.createdAt?.toISOString() ?? null,
    lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: calendarId } = await params;
    const owner = await resolveFeedOwner(request, calendarId);
    if (owner instanceof NextResponse) return owner;
    return NextResponse.json(toResponse(await getFeedToken(owner.userId, calendarId)));
  } catch (error) {
    console.error("[API] GET /api/calendars/[id]/feed-token error:", error);
    return NextResponse.json({ error: "Failed to fetch feed link" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: calendarId } = await params;
    const owner = await resolveFeedOwner(request, calendarId);
    if (owner instanceof NextResponse) return owner;

    const rateLimitResponse = rateLimit(request, owner.userId, "token-creation");
    if (rateLimitResponse) return rateLimitResponse;

    const ownerWhere = and(
      eq(calendarFeedTokens.calendarId, calendarId),
      feedOwnerCondition(owner.userId)
    );
    const created = db.transaction((tx) => {
      const removed = tx.delete(calendarFeedTokens).where(ownerWhere).returning().all();
      const [row] = tx
        .insert(calendarFeedTokens)
        .values({
          calendarId,
          userId: owner.userId,
          token: generateAccessToken(),
          // SQLite's CURRENT_TIMESTAMP default yields text, not the epoch seconds
          // "timestamp" mode expects — set it here like other inserts in this codebase.
          createdAt: new Date(),
        })
        .returning()
        .all();
      return { row, rotated: removed.length > 0 };
    });

    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });
    void logUserAction<CalendarFeedTokenMetadata>({
      action: "calendar_feed_token_created",
      userId: owner.userId,
      resourceType: "calendar",
      resourceId: calendarId,
      metadata: { calendarName: calendar?.name ?? "", rotated: created.rotated },
      request,
    });

    return NextResponse.json(toResponse(created.row), { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/calendars/[id]/feed-token error:", error);
    return NextResponse.json({ error: "Failed to create feed link" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: calendarId } = await params;
    const owner = await resolveFeedOwner(request, calendarId);
    if (owner instanceof NextResponse) return owner;

    const removed = await db
      .delete(calendarFeedTokens)
      .where(and(eq(calendarFeedTokens.calendarId, calendarId), feedOwnerCondition(owner.userId)))
      .returning();

    if (removed.length > 0) {
      const calendar = await db.query.calendars.findFirst({
        where: eq(calendars.id, calendarId),
        columns: { name: true },
      });
      void logUserAction<CalendarFeedTokenMetadata>({
        action: "calendar_feed_token_revoked",
        userId: owner.userId,
        resourceType: "calendar",
        resourceId: calendarId,
        metadata: { calendarName: calendar?.name ?? "" },
        request,
      });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[API] DELETE /api/calendars/[id]/feed-token error:", error);
    return NextResponse.json({ error: "Failed to revoke feed link" }, { status: 500 });
  }
}
