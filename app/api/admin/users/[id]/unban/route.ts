import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, canBanUser } from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import { auth } from "@/lib/auth";
import {
  getValidatedAdminUser,
  getValidatedTargetUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin User Unban API
 *
 * POST /api/admin/users/[id]/unban
 * Unbans a user from the system.
 *
 * Permission: Superadmin only
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

    requireSuperAdmin(currentUser);

    // Rate limiting: admin-user-mutations
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-user-mutations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    const targetUser = await getValidatedTargetUser(targetUserId);
    if (isErrorResponse(targetUser)) return targetUser;

    // Check if user is actually banned
    if (!targetUser.banned) {
      return NextResponse.json(
        { error: "User is not banned" },
        { status: 400 }
      );
    }

    if (!(await canBanUser(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Cannot unban this user" },
        { status: 403 }
      );
    }

    await auth.api.unbanUser({
      headers: request.headers,
      body: {
        userId: targetUserId,
      },
    });

    // Audit log
    await logAuditEvent({
      action: "admin.user.unban",
      userId: currentUser.id,
      resourceType: "user",
      resourceId: targetUserId,
      metadata: {
        targetUser: targetUser.email,
        unbannedBy: currentUser.email,
      },
      request,
      severity: "info",
      isUserVisible: false,
    });

    return NextResponse.json({
      success: true,
      message: "User unbanned successfully",
    });
  } catch (error) {
    console.error("Failed to unban user:", error);
    return NextResponse.json(
      { error: "Failed to unban user" },
      { status: 500 }
    );
  }
}
