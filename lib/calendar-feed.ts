import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens, user, type CalendarFeedToken } from "@/lib/db/schema";
import { hasCapability } from "@/lib/auth/permissions";
import { isAuthEnabled } from "@/lib/auth/feature-flags";

export function feedOwnerCondition(userId: string | null) {
  return userId ? eq(calendarFeedTokens.userId, userId) : isNull(calendarFeedTokens.userId);
}

export async function getFeedToken(
  userId: string | null,
  calendarId: string
): Promise<CalendarFeedToken | null> {
  const row = await db.query.calendarFeedTokens.findFirst({
    where: and(eq(calendarFeedTokens.calendarId, calendarId), feedOwnerCondition(userId)),
  });
  return row ?? null;
}

export async function findFeedToken(token: string): Promise<CalendarFeedToken | null> {
  const row = await db.query.calendarFeedTokens.findFirst({
    where: eq(calendarFeedTokens.token, token),
  });
  return row ?? null;
}

// Feeds carry no session, so the owner's ban and share-link cookies must be handled here.
export async function canReadFeed(userId: string | null, calendarId: string): Promise<boolean> {
  if (!userId) return !isAuthEnabled();
  const owner = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { banned: true, banExpires: true },
  });
  // Same rule as better-auth's admin plugin: an expired ban no longer counts.
  if (owner?.banned && (!owner.banExpires || owner.banExpires.getTime() > Date.now())) return false;
  return hasCapability(userId, calendarId, "viewShifts", { ignoreTokenCookie: true });
}
