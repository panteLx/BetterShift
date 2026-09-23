import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendarFeedTokens, type CalendarFeedToken } from "@/lib/db/schema";

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
