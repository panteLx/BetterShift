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
import { eq, or, sql } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type AccountDeletedMetadata } from "@/lib/audit-log";
import {
  assertNotSoleWorkspaceOwner,
  deleteMemberlessWorkspaces,
  invalidateDeletedWorkspaces,
  SoleWorkspaceOwnerError,
} from "@/lib/auth/account-deletion";

function soleOwnerResponse() {
  return NextResponse.json(
    {
      error:
        "You are the only owner of a workspace with other members. Transfer ownership first.",
    },
    { status: 409 }
  );
}

/**
 * Delete user account endpoint
 *
 * DELETE /api/auth/delete-account
 * Body: { password?: string } (required if user has password-based login)
 *
 * Refused with 409 while the user is the only owner of a workspace that has
 * other members. Otherwise deletes, in one transaction:
 * 0. Workspaces the user is the only member of
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

    try {
      assertNotSoleWorkspaceOwner(userId);
    } catch (error) {
      if (error instanceof SoleWorkspaceOwnerError) return soleOwnerResponse();
      throw error;
    }

    const [calendarCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(calendarsTable)
      .where(eq(calendarsTable.ownerId, userId));

    // Log account deletion event BEFORE deleting the user
    await logUserAction<AccountDeletedMetadata>({
      action: "auth.account.deleted",
      userId: userId,
      resourceType: "user",
      resourceId: userId,
      metadata: {
        calendarsDeleted: Number(calendarCount?.count || 0),
      },
      request: req,
    });

    // One transaction, in foreign-key-safe order
    const deletedWorkspaceSlugs = db.transaction((tx) => {
      const slugs = deleteMemberlessWorkspaces(tx, userId);

      tx.delete(calendarSharesTable)
        .where(
          or(
            eq(calendarSharesTable.userId, userId),
            eq(calendarSharesTable.sharedBy, userId)
          )
        )
        .run();
      tx.delete(userCalendarSubscriptionsTable)
        .where(eq(userCalendarSubscriptionsTable.userId, userId))
        .run();
      // Cascades to shifts, presets, notes, external syncs
      tx.delete(calendarsTable).where(eq(calendarsTable.ownerId, userId)).run();
      tx.delete(sessionTable).where(eq(sessionTable.userId, userId)).run();
      tx.delete(accountTable).where(eq(accountTable.userId, userId)).run();
      tx.delete(userTable).where(eq(userTable.id, userId)).run();

      return slugs;
    });
    invalidateDeletedWorkspaces(deletedWorkspaceSlugs);

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    // The in-transaction re-check can still trip if membership changed since the pre-check
    if (error instanceof SoleWorkspaceOwnerError) return soleOwnerResponse();
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
