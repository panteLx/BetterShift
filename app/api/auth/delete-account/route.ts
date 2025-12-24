import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  user as userTable,
  account as accountTable,
  session as sessionTable,
  calendars as calendarsTable,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";

/**
 * Delete user account endpoint
 *
 * DELETE /api/auth/delete-account
 * Body: { password?: string } (required if user has password-based login)
 *
 * Deletes user account and all associated data:
 * - User record
 * - All sessions
 * - All linked accounts (OAuth, credential)
 * - All owned calendars (cascade deletes shifts, presets, notes)
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

    // Delete user's calendars (cascade will delete shifts, presets, notes)
    await db.delete(calendarsTable).where(eq(calendarsTable.ownerId, userId));

    // Delete user's sessions
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));

    // Delete user's accounts (OAuth + credential)
    await db.delete(accountTable).where(eq(accountTable.userId, userId));

    // Delete user record
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
