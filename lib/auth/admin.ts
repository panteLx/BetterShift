/**
 * Admin Role Helpers
 *
 * Utility functions for checking and enforcing admin permissions.
 * Used throughout the application to protect admin-only routes and features.
 */

import type { User } from "@/lib/auth";
import { APIError } from "better-auth/api";

/**
 * Valid admin roles in the system
 */
const ADMIN_ROLES = ["admin", "superadmin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Check if a user has an admin role (admin or superadmin)
 *
 * @param user - The user object (can be null for unauthenticated users)
 * @returns boolean - true if user is admin or superadmin
 */
export function isAdmin(user: User | null | undefined): boolean {
  if (!user?.role) return false;
  return ADMIN_ROLES.includes(user.role as AdminRole);
}

/**
 * Check if a user has the superadmin role specifically
 *
 * @param user - The user object (can be null for unauthenticated users)
 * @returns boolean - true if user is superadmin
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  return user?.role === "superadmin";
}

/**
 * Require admin role or throw an error
 * Use this in API routes to protect admin-only endpoints
 *
 * @param user - The user object (can be null for unauthenticated users)
 * @throws APIError with status 403 if user is not an admin
 */
export function requireAdmin(
  user: User | null | undefined
): asserts user is User & { role: AdminRole } {
  if (!isAdmin(user)) {
    throw new APIError("FORBIDDEN", {
      message: "Admin access required",
    });
  }
}

/**
 * Require superadmin role or throw an error
 * Use this in API routes to protect superadmin-only endpoints
 *
 * @param user - The user object (can be null for unauthenticated users)
 * @throws APIError with status 403 if user is not a superadmin
 */
export function requireSuperAdmin(
  user: User | null | undefined
): asserts user is User & { role: "superadmin" } {
  if (!isSuperAdmin(user)) {
    throw new APIError("FORBIDDEN", {
      message: "Superadmin access required",
    });
  }
}

/**
 * Get user's admin level (for display purposes)
 *
 * @param user - The user object
 * @returns string - "superadmin", "admin", or "user"
 */
export function getAdminLevel(
  user: User | null | undefined
): "superadmin" | "admin" | "user" {
  if (!user?.role) return "user";
  if (user.role === "superadmin") return "superadmin";
  if (user.role === "admin") return "admin";
  return "user";
}

/**
 * Admin Permission Check Functions
 *
 * These functions determine what actions an admin can perform.
 * Used by both API routes (server-side) and React hooks (client-side).
 * All checks are synchronous - no async API calls needed.
 */

/**
 * Check if admin can edit a target user
 *
 * Rules:
 * - Superadmin: Can edit anyone
 * - Admin: Can edit only regular users (role: "user" or null)
 * - Cannot edit self (use profile page instead)
 *
 * @param adminUser - The admin performing the action
 * @param targetUser - The user being edited
 * @returns boolean - true if admin can edit target user
 */
export function canEditUser(
  adminUser: User | null | undefined,
  targetUser: User | null | undefined
): boolean {
  if (!isAdmin(adminUser) || !targetUser) return false;

  // Superadmin can edit anyone
  if (isSuperAdmin(adminUser)) return true;

  // Admin can only edit regular users
  const targetRole = targetUser.role || "user";
  return targetRole === "user";
}

/**
 * Check if admin can delete a target user
 *
 * Rules:
 * - Only superadmin can delete users
 * - Cannot delete self
 *
 * @param adminUser - The admin performing the action
 * @param targetUser - The user being deleted
 * @returns boolean - true if admin can delete target user
 */
export function canDeleteUser(
  adminUser: User | null | undefined,
  targetUser: User | null | undefined
): boolean {
  if (!isSuperAdmin(adminUser) || !targetUser) return false;
  if (adminUser!.id === targetUser.id) return false;

  return true;
}

/**
 * Check if admin can ban a target user
 *
 * Rules:
 * - Only superadmin can ban users
 * - Cannot ban self
 * - Cannot ban other superadmins
 *
 * @param adminUser - The admin performing the action
 * @param targetUser - The user being banned
 * @returns boolean - true if admin can ban target user
 */
export function canBanUser(
  adminUser: User | null | undefined,
  targetUser: User | null | undefined
): boolean {
  if (!isSuperAdmin(adminUser) || !targetUser) return false;
  if (adminUser!.id === targetUser.id) return false;
  if (targetUser.role === "superadmin") return false;

  return true;
}

/**
 * Check if admin can change a user's role
 *
 * Rules:
 * - Only superadmin can change roles
 * - Cannot change own role
 *
 * @param adminUser - The admin performing the action
 * @param targetUser - The user whose role is being changed
 * @returns boolean - true if admin can change target user's role
 */
export function canChangeUserRole(
  adminUser: User | null | undefined,
  targetUser: User | null | undefined
): boolean {
  if (!isSuperAdmin(adminUser) || !targetUser) return false;
  if (adminUser!.id === targetUser.id) return false;

  return true;
}

/**
 * Check if admin can reset a user's password
 *
 * Rules:
 * - Both admin and superadmin can reset passwords
 * - Cannot reset own password (use change password instead)
 * - Admin cannot reset superadmin passwords
 *
 * @param adminUser - The admin performing the action
 * @param targetUser - The user whose password is being reset
 * @returns boolean - true if admin can reset target user's password
 */
export function canResetPassword(
  adminUser: User | null | undefined,
  targetUser: User | null | undefined
): boolean {
  if (!isAdmin(adminUser) || !targetUser) return false;
  if (adminUser!.id === targetUser.id) return false;

  // Superadmin can reset anyone's password
  if (isSuperAdmin(adminUser)) return true;

  // Admin cannot reset superadmin passwords
  if (targetUser.role === "superadmin") return false;

  return true;
}

/**
 * Check if admin can manage calendar operations
 *
 * Rules:
 * - View: Both admin and superadmin
 * - Delete: Only superadmin
 *
 * @param adminUser - The admin performing the action
 * @param operation - The operation being performed ('view' or 'delete')
 * @returns boolean - true if admin can perform the operation
 */
export function canManageCalendar(
  adminUser: User | null | undefined,
  operation: "view" | "delete"
): boolean {
  if (!isAdmin(adminUser)) return false;

  if (operation === "view") return true;

  // Delete requires superadmin
  return isSuperAdmin(adminUser);
}

/**
 * Check if admin can edit a calendar
 *
 * Rules:
 * - Both admin and superadmin can edit calendars
 * - Can edit name, color, guest permission
 * - Cannot change owner via edit (use transfer instead)
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can edit calendars
 */
export function canEditCalendar(adminUser: User | null | undefined): boolean {
  return isAdmin(adminUser);
}

/**
 * Check if admin can delete a calendar
 *
 * Rules:
 * - Only superadmin can delete calendars
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can delete calendars
 */
export function canDeleteCalendar(adminUser: User | null | undefined): boolean {
  return isSuperAdmin(adminUser);
}

/**
 * Check if admin can transfer calendar ownership
 *
 * Rules:
 * - Both admin and superadmin can transfer calendars
 * - Can transfer any calendar (orphaned or owned)
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can transfer calendars
 */
export function canTransferCalendar(
  adminUser: User | null | undefined
): boolean {
  return isAdmin(adminUser);
}

/**
 * Check if admin can assign orphaned calendars
 *
 * Rules:
 * - Both admin and superadmin can assign calendars
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can assign orphaned calendars
 */
export function canAssignOrphanedCalendar(
  adminUser: User | null | undefined
): boolean {
  return isAdmin(adminUser);
}

/**
 * Check if admin can view audit logs
 *
 * Rules:
 * - Both admin and superadmin can view logs
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can view audit logs
 */
export function canViewAuditLogs(adminUser: User | null | undefined): boolean {
  return isAdmin(adminUser);
}

/**
 * Check if admin can delete audit logs
 *
 * Rules:
 * - Only superadmin can delete logs
 *
 * @param adminUser - The admin performing the action
 * @returns boolean - true if admin can delete audit logs
 */
export function canDeleteAuditLogs(
  adminUser: User | null | undefined
): boolean {
  return isSuperAdmin(adminUser);
}
