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
 * Admin User Ban API
 *
 * POST /api/admin/users/[id]/ban
 * Bans a user from the system.
 *
 * Body:
 * - reason: string (required) - Reason for ban
 * - expiresAt: number | null (optional) - Ban expiration timestamp (ms), null for permanent ban
 *
 * Permission: Superadmin only
 * Restrictions:
 * - Cannot ban self
 * - Cannot ban other superadmins
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

    if (!(await canBanUser(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Cannot ban this user" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason, expiresAt } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Ban reason is required" },
        { status: 400 }
      );
    }

    // Validate expiresAt if provided
    let banExpiresIn: number | undefined = undefined;
    if (expiresAt !== null && expiresAt !== undefined) {
      const expiresDate = new Date(expiresAt);
      if (isNaN(expiresDate.getTime()) || expiresDate <= new Date()) {
        return NextResponse.json(
          { error: "Invalid expiration date (must be in the future)" },
          { status: 400 }
        );
      }
      banExpiresIn = Math.floor((expiresDate.getTime() - Date.now()) / 1000);
    }

    await auth.api.banUser({
      headers: request.headers,
      body: {
        userId: targetUserId,
        banReason: reason,
        banExpiresIn,
      },
    });

    const banExpires = banExpiresIn
      ? new Date(Date.now() + banExpiresIn * 1000)
      : null;

    // Audit log
    await logAuditEvent({
      action: "admin.user.ban",
      userId: currentUser.id,
      resourceType: "user",
      resourceId: targetUserId,
      metadata: {
        targetUser: targetUser.email,
        reason: reason,
        expiresAt: banExpires ? banExpires.toISOString() : "permanent",
        bannedBy: currentUser.email,
      },
      request,
      severity: "warning",
      isUserVisible: false,
    });

    return NextResponse.json({
      success: true,
      message: "User banned successfully",
      expiresAt: banExpires,
    });
  } catch (error) {
    console.error("Failed to ban user:", error);
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }
}
