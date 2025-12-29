import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  account as accountTable,
  session as sessionTable,
} from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type PasswordChangedMetadata } from "@/lib/audit-log";

/**
 * Change user password endpoint
 *
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 */
export async function POST(req: NextRequest) {
  try {
    // Get current session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting check
    const rateLimitResponse = rateLimit(
      req,
      session.user.id,
      "password-change"
    );
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    // Validation
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Get user's current password from account table
    const userAccounts = await db.query.account.findMany({
      where: (accounts, { eq, and }) =>
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.providerId, "credential")
        ),
    });

    if (userAccounts.length === 0) {
      return NextResponse.json(
        { error: "No password set for this account" },
        { status: 400 }
      );
    }

    const account = userAccounts[0];

    // Verify current password using Better Auth's password verification
    const isPasswordValid = await verifyPassword({
      password: currentPassword,
      hash: account.password!,
    });

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Hash new password using Better Auth's password hashing
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in account table
    await db
      .update(accountTable)
      .set({ password: newPasswordHash })
      .where(
        and(
          eq(accountTable.userId, session.user.id),
          eq(accountTable.providerId, "credential")
        )
      );

    // Revoke all other sessions (keep current session active)
    const revokedSessions = await db
      .delete(sessionTable)
      .where(
        and(
          eq(sessionTable.userId, session.user.id),
          ne(sessionTable.token, session.session.token)
        )
      )
      .returning();

    // Log password change event
    await logUserAction<PasswordChangedMetadata>({
      action: "auth.password.changed",
      userId: session.user.id,
      resourceType: "user",
      resourceId: session.user.id,
      metadata: {
        sessionsRevoked: revokedSessions.length,
      },
      request: req,
    });

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
      sessionsRevoked: revokedSessions.length,
    });
  } catch (error) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
