import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, canResetPassword } from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import { auth } from "@/lib/auth";
import {
  getValidatedAdminUser,
  getValidatedTargetUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin User Password Reset API
 *
 * POST /api/admin/users/[id]/password
 * Resets a user's password using Better Auth Admin Plugin.
 *
 * Body:
 * - password: string (required) - New password (plain text, will be hashed)
 *
 * Permission: Admin or Superadmin
 * Restrictions:
 * - Admin can reset regular user passwords only
 * - Admin cannot reset superadmin passwords
 * - Cannot reset own password via admin panel (use profile page)
 */

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: targetUserId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Rate limiting: admin-password-reset (stricter limit)
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-password-reset"
    );
    if (rateLimitResponse) return rateLimitResponse;

    const targetUser = await getValidatedTargetUser(targetUserId);
    if (isErrorResponse(targetUser)) return targetUser;

    if (!(await canResetPassword(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Insufficient permissions to reset this user's password" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    await auth.api.setUserPassword({
      headers: request.headers,
      body: {
        userId: targetUserId,
        newPassword: password,
      },
    });

    // Audit log
    await logAuditEvent({
      action: "admin.user.password_reset",
      userId: currentUser.id,
      resourceType: "user",
      resourceId: targetUserId,
      metadata: {
        targetUser: targetUser.email,
        resetBy: currentUser.email,
      },
      request,
      severity: "warning",
      isUserVisible: false,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Failed to reset password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}
