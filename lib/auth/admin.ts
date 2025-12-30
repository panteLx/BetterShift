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
