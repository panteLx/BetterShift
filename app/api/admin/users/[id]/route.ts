import { NextRequest, NextResponse } from "next/server";
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
import {
  requireAdmin,
  requireSuperAdmin,
  canEditUser,
  canDeleteUser,
  canChangeUserRole,
} from "@/lib/auth/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";
import { auth } from "@/lib/auth";
import {
  getValidatedAdminUser,
  getValidatedTargetUser,
  isErrorResponse,
} from "@/lib/auth/admin-helpers";

/**
 * Admin User Detail API
 *
 * GET /api/admin/users/[id]
 * Returns detailed information about a specific user.
 *
 * PATCH /api/admin/users/[id]
 * Updates user information (name, email, role).
 * - Superadmin: Can update any user (including role)
 * - Admin: Can update regular users only (no role change)
 *
 * DELETE /api/admin/users/[id]
 * Deletes user and all associated data.
 * - Superadmin only
 * - Cannot delete self
 *
 * Permission: Admin or Superadmin (role-based restrictions apply)
 */

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: targetUserId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    const targetUser = await getValidatedTargetUser(targetUserId);
    if (isErrorResponse(targetUser)) return targetUser;

    // Get owned calendars
    const ownedCalendars = await db
      .select({
        id: calendarsTable.id,
        name: calendarsTable.name,
        color: calendarsTable.color,
        createdAt: calendarsTable.createdAt,
      })
      .from(calendarsTable)
      .where(eq(calendarsTable.ownerId, targetUserId));

    // Get shared calendars (with calendar name and permission)
    const sharedCalendars = await db
      .select({
        id: calendarSharesTable.id,
        calendarId: calendarSharesTable.calendarId,
        name: calendarsTable.name,
        permission: calendarSharesTable.permission,
        createdAt: calendarSharesTable.createdAt,
      })
      .from(calendarSharesTable)
      .innerJoin(
        calendarsTable,
        eq(calendarSharesTable.calendarId, calendarsTable.id)
      )
      .where(eq(calendarSharesTable.userId, targetUserId));

    const sharesCount = sharedCalendars.length;

    // Get linked accounts
    const accounts = await db
      .select({
        id: accountTable.id,
        providerId: accountTable.providerId,
        createdAt: accountTable.createdAt,
      })
      .from(accountTable)
      .where(eq(accountTable.userId, targetUserId));

    // Get active sessions count
    const [sessionsCount] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(sessionTable)
      .where(eq(sessionTable.userId, targetUserId));

    return NextResponse.json({
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        emailVerified: targetUser.emailVerified,
        image: targetUser.image,
        role: targetUser.role || "user",
        banned: targetUser.banned || false,
        banReason: targetUser.banReason,
        banExpires: targetUser.banExpires,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      },
      calendars: ownedCalendars,
      sharedCalendars: sharedCalendars.map((share) => ({
        id: share.calendarId,
        name: share.name,
        permission: share.permission,
      })),
      sharesCount: sharesCount,
      accounts,
      sessionsCount: Number(sessionsCount?.count || 0),
    });
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    return NextResponse.json(
      { error: "Failed to fetch user details" },
      { status: 500 }
    );
  }
}

// PATCH: Update user
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: targetUserId } = await params;
    const currentUser = await getValidatedAdminUser(request);
    if (isErrorResponse(currentUser)) return currentUser;

    requireAdmin(currentUser);

    // Rate limiting: admin-user-mutations
    const rateLimitResponse = rateLimit(
      request,
      currentUser.id,
      "admin-user-mutations"
    );
    if (rateLimitResponse) return rateLimitResponse;

    const targetUser = await getValidatedTargetUser(targetUserId);
    if (isErrorResponse(targetUser)) return targetUser;

    if (!(await canEditUser(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Insufficient permissions to edit this user" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, role } = body;

    // Track changes for audit log
    const changes: string[] = [];
    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    // Check what's changing
    const hasNameChange = name !== undefined && name !== targetUser.name;
    const hasEmailChange = email !== undefined && email !== targetUser.email;
    const hasRoleChange =
      role !== undefined && role !== (targetUser.role || "user");

    if (hasRoleChange && !(await canChangeUserRole(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Insufficient permissions to change user role" },
        { status: 403 }
      );
    }

    // If no changes, return early
    if (!hasNameChange && !hasEmailChange && !hasRoleChange) {
      return NextResponse.json({
        success: true,
        message: "No changes to apply",
      });
    }

    if (hasNameChange || hasEmailChange) {
      const updateData: {
        name?: string;
        email?: string;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (hasNameChange) {
        updateData.name = name;
        changes.push("name");
        oldValues.name = targetUser.name;
        newValues.name = name;
      }

      if (hasEmailChange) {
        // Check if email is already taken
        const [existingUser] = await db
          .select()
          .from(userTable)
          .where(eq(userTable.email, email))
          .limit(1);

        if (existingUser && existingUser.id !== targetUserId) {
          return NextResponse.json(
            { error: "Email already in use" },
            { status: 400 }
          );
        }

        updateData.email = email;
        changes.push("email");
        oldValues.email = targetUser.email;
        newValues.email = email;
      }

      await db
        .update(userTable)
        .set(updateData)
        .where(eq(userTable.id, targetUserId));
    }

    if (hasRoleChange) {
      await db
        .update(userTable)
        .set({
          role: role,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, targetUserId));

      changes.push("role");
      oldValues.role = targetUser.role || "user";
      newValues.role = role;
    }

    // Audit log
    await logAuditEvent({
      action: "admin.user.update",
      userId: currentUser.id,
      resourceType: "user",
      resourceId: targetUserId,
      metadata: {
        targetUser: targetUser.email,
        changes,
        oldValues,
        newValues,
        updatedBy: currentUser.email,
      },
      request,
      severity: "info",
      isUserVisible: false,
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      changes,
    });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE: Delete user
export async function DELETE(
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

    if (!(await canDeleteUser(currentUser, targetUser))) {
      return NextResponse.json(
        { error: "Cannot delete this user" },
        { status: 403 }
      );
    }

    // Count calendars before deletion (for audit log)
    const [calendarCount] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(calendarsTable)
      .where(eq(calendarsTable.ownerId, targetUserId));

    const calendarsDeleted = Number(calendarCount?.count || 0);

    await db
      .delete(calendarSharesTable)
      .where(
        or(
          eq(calendarSharesTable.userId, targetUserId),
          eq(calendarSharesTable.sharedBy, targetUserId)
        )
      );

    await db
      .delete(userCalendarSubscriptionsTable)
      .where(eq(userCalendarSubscriptionsTable.userId, targetUserId));

    await db
      .delete(calendarsTable)
      .where(eq(calendarsTable.ownerId, targetUserId));

    // Audit log BEFORE deleting user
    await logAuditEvent({
      action: "admin.user.delete",
      userId: currentUser.id,
      resourceType: "user",
      resourceId: targetUserId,
      metadata: {
        deletedUser: targetUser.email,
        calendarsDeleted,
        deletedBy: currentUser.email,
      },
      request,
      severity: "critical",
      isUserVisible: false,
    });

    await auth.api.removeUser({
      headers: request.headers,
      body: {
        userId: targetUserId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
      calendarsDeleted,
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
