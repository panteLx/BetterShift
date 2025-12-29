import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  user as userTable,
  account as accountTable,
  session as sessionTable,
  calendars as calendarsTable,
  calendarShares as calendarSharesTable,
  userCalendarSubscriptions as userCalendarSubscriptionsTable,
} from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type AccountDeletedMetadata } from "@/lib/audit-log";

/**
 * Delete user account endpoint
 *
 * DELETE /api/auth/delete-account
 * Body: { password?: string } (required if user has password-based login)
 *
 * Deletes user account and all associated data in the correct order:
 * 1. Calendar shares (where user is participant or sharer)
 * 2. Calendar subscriptions
 * 3. Owned calendars (cascade deletes shifts, presets, notes, external syncs)
 * 4. Sessions
 * 5. Linked accounts (OAuth, credential)
 * 6. User record
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimitResponse = rateLimit(req, session.user.id, "account-delete");
    if (rateLimitResponse) return rateLimitResponse;

    const userId = session.user.id;

    // Check if user has password-based login
    const credentialAccounts = await db.query.account.findMany({
      where: (accounts, { eq, and }) =>
        and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
    });

    // If user has password, require password confirmation
    if (credentialAccounts.length > 0) {
      const body = await req.json();
      const { password } = body;

      if (!password) {
        return NextResponse.json(
          { error: "Password confirmation required" },
          { status: 400 }
        );
      }

      const account = credentialAccounts[0];

      // Verify password using Better Auth's password verification
      const isPasswordValid = await verifyPassword({
        password: password,
        hash: account.password!,
      });

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 401 }
        );
      }
    }

    // Delete in the correct order to avoid foreign key constraint violations

    // 1. Delete calendar shares where user is sharer OR shared with
    await db
      .delete(calendarSharesTable)
      .where(
        or(
          eq(calendarSharesTable.userId, userId),
          eq(calendarSharesTable.sharedBy, userId)
        )
      );

    // 2. Delete user's calendar subscriptions
    await db
      .delete(userCalendarSubscriptionsTable)
      .where(eq(userCalendarSubscriptionsTable.userId, userId));

    // 3. Delete user's calendars (cascade will delete shifts, presets, notes, external syncs)
    const deletedCalendars = await db
      .delete(calendarsTable)
      .where(eq(calendarsTable.ownerId, userId))
      .returning();

    // Log account deletion event BEFORE deleting the user
    await logUserAction<AccountDeletedMetadata>({
      action: "auth.account.deleted",
      userId: userId,
      resourceType: "user",
      resourceId: userId,
      metadata: {
        calendarsDeleted: deletedCalendars.length,
      },
      request: req,
    });

    // 4. Delete user's sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // 5. Delete user's accounts (OAuth + credential)
    await db.delete(accountTable).where(eq(accountTable.userId, userId));

    // 6. Delete user record
    await db.delete(userTable).where(eq(userTable.id, userId));

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
