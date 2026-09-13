import { db } from "@/lib/db";
import { shifts, shiftSignups } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getShiftSignupPermission, canViewCalendar } from "@/lib/auth/permissions";
import type { CalendarMember, ShiftSignupUser } from "@/lib/types";

export type AddShiftSignupResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

type ShiftForSignups = {
  id: string;
  calendarId: string;
  signupCapacity: number | null;
};

/** Shared "fetch shift by id" for the signup routes, selecting only what they need. */
export async function getShiftOrNull(
  shiftId: string
): Promise<ShiftForSignups | null> {
  const [shift] = await db
    .select({
      id: shifts.id,
      calendarId: shifts.calendarId,
      signupCapacity: shifts.signupCapacity,
    })
    .from(shifts)
    .where(eq(shifts.id, shiftId));
  return shift ?? null;
}

/** All signups for a shift, resolved to their signed-up user. */
export async function getShiftSignupUsers(
  shiftId: string
): Promise<ShiftSignupUser[]> {
  const rows = await db.query.shiftSignups.findMany({
    where: eq(shiftSignups.shiftId, shiftId),
    with: {
      user: { columns: { id: true, name: true, email: true, image: true } },
    },
    orderBy: (signups, { asc }) => [asc(signups.createdAt)],
  });
  return rows.map((row) => row.user);
}

/** Whether requestingUserId may add/remove targetUserId's signup, given a resolved signup permission. */
export function canActOnSignup(
  permission: { canManageOwn: boolean; canManageOthers: boolean },
  requestingUserId: string,
  targetUserId: string
): boolean {
  return targetUserId === requestingUserId
    ? permission.canManageOwn
    : permission.canManageOthers;
}

/**
 * Adds one signup, enforcing the same rules for both the dedicated signups
 * route and initial signups passed along with shift creation. `existingUserIds`
 * is mutated on success so callers can loop over several target users while
 * keeping capacity/duplicate checks correct across the batch.
 */
export async function addShiftSignup(
  shiftId: string,
  calendarId: string,
  requestingUserId: string,
  targetUserId: string,
  existingUserIds: Set<string>,
  capacity: number | null
): Promise<AddShiftSignupResult> {
  const permission = await getShiftSignupPermission(
    requestingUserId,
    calendarId
  );
  if (!canActOnSignup(permission, requestingUserId, targetUserId)) {
    return { ok: false, error: "Insufficient permissions", status: 403 };
  }

  // The assigned user must already have access to the calendar, otherwise
  // they would have no way to see a shift they are signed up for.
  if (targetUserId !== requestingUserId) {
    const targetHasAccess = await canViewCalendar(targetUserId, calendarId);
    if (!targetHasAccess) {
      return {
        ok: false,
        error: "Target user has no access to this calendar",
        status: 400,
      };
    }
  }

  if (existingUserIds.has(targetUserId)) {
    return {
      ok: false,
      error: "User is already signed up for this shift",
      status: 409,
    };
  }

  if (capacity != null && existingUserIds.size >= capacity) {
    return {
      ok: false,
      error: "Shift signup capacity reached",
      status: 409,
    };
  }

  await db.insert(shiftSignups).values({
    shiftId,
    userId: targetUserId,
    signedUpBy: requestingUserId,
  });
  existingUserIds.add(targetUserId);

  return { ok: true };
}

// Attaches each shift's signed-up members without N+1 queries.
export async function withSignups<T extends { id: string }>(
  shiftRows: T[]
): Promise<(T & { signups: CalendarMember[] })[]> {
  if (shiftRows.length === 0) return [];

  const rows = await db.query.shiftSignups.findMany({
    where: inArray(
      shiftSignups.shiftId,
      shiftRows.map((s) => s.id)
    ),
    with: { user: { columns: { id: true, name: true, image: true } } },
    orderBy: (signups, { asc }) => [asc(signups.createdAt)],
  });

  const byShiftId = new Map<string, CalendarMember[]>();
  for (const row of rows) {
    const list = byShiftId.get(row.shiftId) ?? [];
    list.push(row.user);
    byShiftId.set(row.shiftId, list);
  }

  return shiftRows.map((shift) => ({
    ...shift,
    signups: byShiftId.get(shift.id) ?? [],
  }));
}
