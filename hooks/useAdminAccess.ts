"use client";

import { useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  isAdmin,
  isSuperAdmin,
  getAdminLevel,
  canEditUser,
  canDeleteUser,
  canBanUser,
  canChangeUserRole,
  canManageCalendar,
  canAssignOrphanedCalendar,
  canViewAuditLogs,
  canDeleteAuditLogs,
  canResetPassword,
} from "@/lib/auth/admin";
import type { User } from "@/lib/auth";

/**
 * Hook to check if current user is an admin
 *
 * @returns boolean - true if user is admin or superadmin
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return useMemo(() => isAdmin(user), [user]);
}

/**
 * Hook to check if current user is a superadmin
 *
 * @returns boolean - true if user is superadmin
 */
export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return useMemo(() => isSuperAdmin(user), [user]);
}

/**
 * Hook to get user's admin level
 *
 * @returns "superadmin" | "admin" | "user"
 */
export function useAdminLevel(): "superadmin" | "admin" | "user" {
  const { user } = useAuth();
  return useMemo(() => getAdminLevel(user), [user]);
}

/**
 * Hook to require admin access (redirects non-admins)
 *
 * Use this in admin pages to enforce access control
 * Redirects to home page if user is not an admin
 *
 * @param redirectTo - Optional redirect path (default: "/")
 */
export function useRequireAdmin(redirectTo: string = "/"): void {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Check if user is admin
    if (!isAdmin(user)) {
      // Redirect non-admins
      const url = new URL(redirectTo, window.location.origin);
      url.searchParams.set("error", "admin_access_required");
      router.push(url.toString());
    }
  }, [user, isLoading, router, redirectTo]);
}

/**
 * Hook to check if current admin can edit a specific user
 *
 * @param targetUser - The user to check edit permissions for
 * @returns boolean - true if current admin can edit the target user
 */
export function useCanEditUser(targetUser: User | null | undefined): boolean {
  const { user } = useAuth();
  return useMemo(() => canEditUser(user, targetUser), [user, targetUser]);
}

/**
 * Hook to check if current admin can delete a specific user
 *
 * @param targetUser - The user to check delete permissions for
 * @returns boolean - true if current admin can delete the target user
 */
export function useCanDeleteUser(targetUser: User | null | undefined): boolean {
  const { user } = useAuth();
  return useMemo(() => canDeleteUser(user, targetUser), [user, targetUser]);
}

/**
 * Hook to check if current admin can ban a specific user
 *
 * @param targetUser - The user to check ban permissions for
 * @returns boolean - true if current admin can ban the target user
 */
export function useCanBanUser(targetUser: User | null | undefined): boolean {
  const { user } = useAuth();
  return useMemo(() => canBanUser(user, targetUser), [user, targetUser]);
}

/**
 * Hook to check if current admin can change user roles
 *
 * @param targetUser - The user to check role change permissions for
 * @returns boolean - true if current admin can change the target user's role
 */
export function useCanChangeUserRole(
  targetUser: User | null | undefined
): boolean {
  const { user } = useAuth();
  return useMemo(() => canChangeUserRole(user, targetUser), [user, targetUser]);
}

/**
 * Hook to check if current admin can manage calendars
 *
 * @param operation - The operation type ("view" | "delete")
 * @returns boolean - true if current admin can perform the operation
 */
export function useCanManageCalendar(operation: "view" | "delete"): boolean {
  const { user } = useAuth();
  return useMemo(() => canManageCalendar(user, operation), [user, operation]);
}

/**
 * Hook to check if current admin can assign orphaned calendars
 *
 * @returns boolean - true if current admin can assign orphaned calendars
 */
export function useCanAssignOrphanedCalendar(): boolean {
  const { user } = useAuth();
  return useMemo(() => canAssignOrphanedCalendar(user), [user]);
}

/**
 * Hook to check if current admin can view audit logs
 *
 * @returns boolean - true if current admin can view audit logs
 */
export function useCanViewAuditLogs(): boolean {
  const { user } = useAuth();
  return useMemo(() => canViewAuditLogs(user), [user]);
}

/**
 * Hook to check if current admin can delete audit logs
 *
 * @returns boolean - true if current admin can delete audit logs
 */
export function useCanDeleteAuditLogs(): boolean {
  const { user } = useAuth();
  return useMemo(() => canDeleteAuditLogs(user), [user]);
}

/**
 * Hook to check if current admin can reset user passwords
 *
 * @param targetUser - The user to check password reset permissions for
 * @returns boolean - true if current admin can reset the target user's password
 */
export function useCanResetPassword(
  targetUser: User | null | undefined
): boolean {
  const { user } = useAuth();
  return useMemo(() => canResetPassword(user, targetUser), [user, targetUser]);
}

/**
 * Hook to get all admin permissions for a target user
 *
 * Convenience hook that returns all permission checks at once
 *
 * @param targetUser - The user to check permissions for
 * @returns Object with all permission checks
 */
export function useUserPermissions(targetUser: User | null | undefined) {
  const { user } = useAuth();

  return useMemo(
    () => ({
      canEdit: canEditUser(user, targetUser),
      canDelete: canDeleteUser(user, targetUser),
      canBan: canBanUser(user, targetUser),
      canChangeRole: canChangeUserRole(user, targetUser),
      canResetPassword: canResetPassword(user, targetUser),
    }),
    [user, targetUser]
  );
}

/**
 * Hook to check if current admin can edit calendars
 *
 * @returns boolean - true if current admin can edit calendars
 */
export function useCanEditCalendar(): boolean {
  const { user } = useAuth();
  // Admin and Superadmin can edit calendars
  return useMemo(() => isAdmin(user), [user]);
}

/**
 * Hook to check if current admin can delete calendars
 *
 * @returns boolean - true if current admin can delete calendars
 */
export function useCanDeleteCalendar(): boolean {
  const { user } = useAuth();
  // Only Superadmin can delete calendars
  return useMemo(() => isSuperAdmin(user), [user]);
}

/**
 * Hook to check if current admin can transfer calendar ownership
 *
 * @returns boolean - true if current admin can transfer calendars
 */
export function useCanTransferCalendar(): boolean {
  const { user } = useAuth();
  // Admin and Superadmin can transfer calendars
  return useMemo(() => isAdmin(user), [user]);
}
