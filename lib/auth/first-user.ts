/**
 * First User Auto-Promotion
 *
 * Handles automatic promotion of the first registered user to superadmin role.
 * This ensures there's always at least one admin user who can access the admin panel
 * and manage orphaned calendars.
 */

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * Check if this is the only user in the database (i.e., the first user)
 * @param currentUserId - The ID of the current user to exclude from count
 * @returns Promise<boolean> - true if this is the only user (first user)
 */
export async function isFirstUser(currentUserId: string): Promise<boolean> {
  const users = await db.select({ id: user.id }).from(user).limit(2);
  // First user if only one user exists and it's the current user
  return users.length === 1 && users[0].id === currentUserId;
}

/**
 * Promote a user to superadmin role
 * This should only be called for the first registered user
 *
 * @param userId - The ID of the user to promote
 * @returns Promise<void>
 */
export async function promoteToSuperAdmin(userId: string): Promise<void> {
  await db.update(user).set({ role: "superadmin" }).where(eq(user.id, userId));

  // Log the promotion to audit log
  await logAuditEvent({
    userId,
    action: "user_promoted_to_superadmin",
    resourceType: "user",
    resourceId: userId,
    severity: "info",
    metadata: {
      reason: "First user registration - automatic superadmin promotion",
    },
  });
}

/**
 * Check if this is the first user and promote them to superadmin if true
 * This is called from the Better Auth after hook during sign-up
 *
 * @param userId - The ID of the newly registered user
 * @returns Promise<boolean> - true if user was promoted, false otherwise
 */
export async function handleFirstUserPromotion(
  userId: string
): Promise<boolean> {
  const isFirst = await isFirstUser(userId);

  if (isFirst) {
    await promoteToSuperAdmin(userId);
    return true;
  }

  return false;
}
