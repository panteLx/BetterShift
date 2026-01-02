"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { User } from "@/lib/auth";

/**
 * Extended User Type with Admin-specific fields
 */
export interface AdminUser extends User {
  calendarCount: number;
  sharesCount: number;
  lastActivity: Date | null;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
}

/**
 * User Details Type (for user details sheet)
 */
export interface UserDetails extends AdminUser {
  accounts: Array<{
    id: string;
    providerId: string;
    accountId: string;
    createdAt: Date;
  }>;
  sessionsCount: number;
  ownedCalendars: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  sharedCalendars: Array<{
    id: string;
    name: string;
    permission: string;
  }>;
}

/**
 * User Filters
 */
export interface UserFilters {
  search?: string;
  role?: "all" | "superadmin" | "admin" | "user";
  status?: "all" | "active" | "banned";
}

/**
 * User Sort Options
 */
export interface UserSort {
  field: "name" | "email" | "createdAt" | "role";
  direction: "asc" | "desc";
}

/**
 * Pagination Options
 */
export interface Pagination {
  page: number;
  limit: number;
}

/**
 * Users List Response
 */
export interface UsersListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Admin Users Management Hook
 *
 * Provides functions for managing users in the admin panel.
 *
 * Features:
 * - Fetch users with filtering, sorting, and pagination
 * - Get user details
 * - Update user information
 * - Ban/Unban users
 * - Delete users
 * - Reset user passwords
 * - Error handling with toast notifications
 *
 * @returns Object with user management functions and state
 */
export function useAdminUsers() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetch users list with filters, sort, and pagination
   */
  const fetchUsers = useCallback(
    async (
      filters: UserFilters = {},
      sort: UserSort = { field: "createdAt", direction: "desc" },
      pagination: Pagination = { page: 1, limit: 25 }
    ): Promise<UsersListResponse | null> => {
      try {
        setIsLoading(true);

        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.role && filters.role !== "all")
          params.set("role", filters.role);
        if (filters.status && filters.status !== "all") {
          // Map 'active'/'banned' to boolean for API
          params.set("banned", filters.status === "banned" ? "true" : "false");
        }
        params.set("sortBy", sort.field);
        params.set("sortDir", sort.direction);
        params.set("page", pagination.page.toString());
        params.set("limit", pagination.limit.toString());

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          throw new Error(
            t("common.fetchError", { item: t("common.labels.users") })
          );
        }

        const data = await response.json();

        // Parse date strings to Date objects
        const users = data.users.map((user: Record<string, unknown>) => ({
          ...user,
          createdAt: new Date(user.createdAt as string),
          updatedAt: new Date(user.updatedAt as string),
          lastActivity: user.lastActivity
            ? new Date(user.lastActivity as string)
            : null,
          banExpires: user.banExpires
            ? new Date(user.banExpires as string)
            : null,
        }));

        return {
          ...data,
          users,
        };
      } catch (error) {
        console.error("Failed to fetch users:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.fetchError", { item: t("common.labels.users") })
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Fetch detailed user information
   */
  const fetchUserDetails = useCallback(
    async (userId: string): Promise<UserDetails | null> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(
            t("common.fetchError", { item: t("admin.userDetails") })
          );
        }

        const data = await response.json();

        // Parse date strings to Date objects
        return {
          ...data.user,
          createdAt: new Date(data.user.createdAt as string),
          updatedAt: new Date(data.user.updatedAt as string),
          lastActivity: data.lastActivity
            ? new Date(data.lastActivity as string)
            : null,
          banExpires: data.user.banExpires
            ? new Date(data.user.banExpires as string)
            : null,
          ownedCalendars: data.calendars || [],
          sharedCalendars: data.sharedCalendars || [],
          sharesCount: data.sharesCount,
          calendarCount: (data.calendars?.length || 0) + data.sharesCount,
          accounts: data.accounts.map((account: Record<string, unknown>) => ({
            ...account,
            createdAt: new Date(account.createdAt as string),
          })),
          sessionsCount: data.sessionsCount,
        };
      } catch (error) {
        console.error("Failed to fetch user details:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.fetchError", { item: t("admin.userDetails") })
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Update user information
   */
  const updateUser = useCallback(
    async (
      userId: string,
      data: { name?: string; email?: string; role?: string }
    ): Promise<boolean> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(
            t("common.updateError", { item: t("common.labels.user") })
          );
        }

        toast.success(t("common.updated", { item: t("common.labels.user") }));
        return true;
      } catch (error) {
        console.error("Failed to update user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.updateError", { item: t("common.labels.user") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Ban user
   */
  const banUser = useCallback(
    async (
      userId: string,
      reason: string,
      expiresAt?: Date
    ): Promise<boolean> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}/ban`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason,
            expiresAt: expiresAt?.toISOString(),
          }),
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(
            t("common.banError", { item: t("common.labels.user") })
          );
        }

        toast.success(t("common.banned", { item: t("common.labels.user") }));
        return true;
      } catch (error) {
        console.error("Failed to ban user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.banError", { item: t("common.labels.user") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Unban user
   */
  const unbanUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}/unban`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(
            t("common.unbanError", { item: t("common.labels.user") })
          );
        }

        toast.success(t("common.unbanned", { item: t("common.labels.user") }));
        return true;
      } catch (error) {
        console.error("Failed to unban user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.unbanError", { item: t("common.labels.user") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Delete user
   */
  const deleteUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(
            t("common.deleteError", { item: t("common.labels.user") })
          );
        }

        toast.success(t("common.deleted", { item: t("common.labels.user") }));
        return true;
      } catch (error) {
        console.error("Failed to delete user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.deleteError", { item: t("common.labels.user") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Reset user password
   */
  const resetPassword = useCallback(
    async (userId: string, newPassword: string): Promise<boolean> => {
      try {
        setIsLoading(true);

        const response = await fetch(`/api/admin/users/${userId}/password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: newPassword }),
        });

        if (!response.ok) {
          if (response.status === 403) {
            throw new Error(t("admin.accessDenied"));
          }
          if (response.status === 404) {
            throw new Error(t("admin.userNotFound"));
          }
          throw new Error(t("common.passwordResetError"));
        }

        toast.success(t("common.passwordReset"));
        return true;
      } catch (error) {
        console.error("Failed to reset password:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : t("common.passwordResetError")
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  return {
    isLoading,
    fetchUsers,
    fetchUserDetails,
    updateUser,
    banUser,
    unbanUser,
    deleteUser,
    resetPassword,
  };
}
