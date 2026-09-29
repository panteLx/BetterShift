import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  calendarFeedTokens,
  calendarShares,
  calendars,
  member,
  user,
  userCalendarSubscriptions,
} from "@/lib/db/schema";

export type EndMembershipResult =
  | { ok: true; calendarsTransferred: number }
  | { ok: false; reason: "not_member" | "owner" | "no_owner" };

/**
 * The only way a membership ends (leave, remove, admin remove): drops the user's shares,
 * feed tokens and subscriptions in this workspace and hands their calendars to the owner.
 */
export function endMembership(workspaceId: string, userId: string): EndMembershipResult {
  return db.transaction((tx) => {
    const row = tx
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, userId)))
      .get();
    if (!row) return { ok: false, reason: "not_member" } as const;
    if (row.role === "owner") return { ok: false, reason: "owner" } as const;

    const workspaceCalendars = tx.select({ id: calendars.id }).from(calendars).where(eq(calendars.workspaceId, workspaceId));
    const owned = tx
      .select({ id: calendars.id })
      .from(calendars)
      .where(and(eq(calendars.workspaceId, workspaceId), eq(calendars.ownerId, userId)))
      .all();

    let newOwnerId: string | null = null;
    if (owned.length > 0) {
      const owner = tx
        .select({ userId: member.userId })
        .from(member)
        .where(and(eq(member.organizationId, workspaceId), eq(member.role, "owner")))
        .orderBy(asc(member.createdAt))
        .get();
      if (!owner) return { ok: false, reason: "no_owner" } as const;
      newOwnerId = owner.userId;
    }

    tx.delete(calendarShares)
      .where(and(eq(calendarShares.userId, userId), inArray(calendarShares.calendarId, workspaceCalendars)))
      .run();
    tx.delete(calendarFeedTokens)
      .where(and(eq(calendarFeedTokens.userId, userId), inArray(calendarFeedTokens.calendarId, workspaceCalendars)))
      .run();
    tx.delete(userCalendarSubscriptions)
      .where(and(eq(userCalendarSubscriptions.userId, userId), inArray(userCalendarSubscriptions.calendarId, workspaceCalendars)))
      .run();

    if (newOwnerId && owned.length > 0) {
      const ids = owned.map((c) => c.id);
      tx.update(calendars).set({ ownerId: newOwnerId }).where(inArray(calendars.id, ids)).run();
      // The new owner no longer needs a share or a subscription on calendars they now own,
      // otherwise they'd see their own calendar as "dismissed" and re-subscribing would throw.
      tx.delete(calendarShares).where(and(eq(calendarShares.userId, newOwnerId), inArray(calendarShares.calendarId, ids))).run();
      tx.delete(userCalendarSubscriptions).where(and(eq(userCalendarSubscriptions.userId, newOwnerId), inArray(userCalendarSubscriptions.calendarId, ids))).run();
    }

    tx.delete(member).where(eq(member.id, row.id)).run();
    return { ok: true, calendarsTransferred: owned.length } as const;
  });
}

export async function listWorkspaceMembers(workspaceId: string) {
  const rows = await db
    .select({ userId: user.id, name: user.name, email: user.email, image: user.image, role: member.role, joinedAt: member.createdAt })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, workspaceId))
    .orderBy(asc(member.createdAt));
  return rows.map((r) => ({ ...r, joinedAt: r.joinedAt.toISOString() }));
}
