"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/lib/auth";
import { REFETCH_INTERVAL } from "@/lib/query-client";

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
 * Fetch users list from API
 */
async function fetchUsersApi(
  filters: UserFilters,
  sort: UserSort,
  pagination: Pagination,
  t: ReturnType<typeof useTranslations>
): Promise<UsersListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role && filters.role !== "all") params.set("role", filters.role);
  if (filters.status && filters.status !== "all") {
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
    throw new Error(t("common.fetchError", { item: t("common.labels.users") }));
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
    banExpires: user.banExpires ? new Date(user.banExpires as string) : null,
  }));

  return {
    ...data,
    users,
  };
}

/**
 * Fetch user details from API
 */
async function fetchUserDetailsApi(
  userId: string,
  t: ReturnType<typeof useTranslations>
): Promise<UserDetails> {
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
    throw new Error(t("common.fetchError", { item: t("admin.userDetails") }));
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
}

/**
 * Update user via API
 */
async function updateUserApi(
  userId: string,
  data: { name?: string; email?: string; role?: string },
  t: ReturnType<typeof useTranslations>
): Promise<void> {
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
    throw new Error(t("common.updateError", { item: t("common.labels.user") }));
  }
}

/**
 * Ban user via API
 */
async function banUserApi(
  userId: string,
  reason: string,
  expiresAt: Date | undefined,
  t: ReturnType<typeof useTranslations>
): Promise<void> {
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
    throw new Error(t("common.banError", { item: t("common.labels.user") }));
  }
}

/**
 * Unban user via API
 */
async function unbanUserApi(
  userId: string,
  t: ReturnType<typeof useTranslations>
): Promise<void> {
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
    throw new Error(t("common.unbanError", { item: t("common.labels.user") }));
  }
}

/**
 * Delete user via API
 */
async function deleteUserApi(
  userId: string,
  t: ReturnType<typeof useTranslations>
): Promise<void> {
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
    throw new Error(t("common.deleteError", { item: t("common.labels.user") }));
  }
}

/**
 * Reset user password via API
 */
async function resetPasswordApi(
  userId: string,
  newPassword: string,
  t: ReturnType<typeof useTranslations>
): Promise<void> {
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
}

/**
 * Admin Users Management Hook
 *
 * Provides functions for managing users in the admin panel.
 * Uses React Query for automatic polling and cache management.
 *
 * Features:
 * - Fetch users with filtering, sorting, and pagination
 * - Get user details
 * - Update user information
 * - Ban/Unban users
 * - Delete users
 * - Reset user passwords
 * - Optimistic updates for instant UI feedback
 * - Error handling with toast notifications
 * - Automatic cache invalidation
 *
 * @param filters - User filters (search, role, status)
 * @param sort - Sort options (field, direction)
 * @param pagination - Pagination options (page, limit)
 * @returns Object with user data and management functions
 */
export function useAdminUsers(
  filters: UserFilters = {},
  sort: UserSort = { field: "createdAt", direction: "desc" },
  pagination: Pagination = { page: 1, limit: 25 }
) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch users list with polling
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: queryKeys.admin.users({ filters, sort, pagination }),
    queryFn: () => fetchUsersApi(filters, sort, pagination, t),
    refetchInterval: REFETCH_INTERVAL,
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: { name?: string; email?: string; role?: string };
    }) => updateUserApi(userId, data, t),
    onMutate: async ({ userId, data }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.users({ filters, sort, pagination }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.users({ filters, sort, pagination })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        (old: UsersListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((user) =>
              user.id === userId ? { ...user, ...data } : user
            ),
          };
        }
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.updateError", { item: t("common.labels.user") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("common.labels.user") }));
    },
    onSettled: () => {
      // Invalidate all user queries
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Ban user mutation
  const banMutation = useMutation({
    mutationFn: ({
      userId,
      reason,
      expiresAt,
    }: {
      userId: string;
      reason: string;
      expiresAt?: Date;
    }) => banUserApi(userId, reason, expiresAt, t),
    onMutate: async ({ userId, reason, expiresAt }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.users({ filters, sort, pagination }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.users({ filters, sort, pagination })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        (old: UsersListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((user) =>
              user.id === userId
                ? {
                    ...user,
                    banned: true,
                    banReason: reason,
                    banExpires: expiresAt || null,
                  }
                : user
            ),
          };
        }
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.banError", { item: t("common.labels.user") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.banned", { item: t("common.labels.user") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Unban user mutation
  const unbanMutation = useMutation({
    mutationFn: (userId: string) => unbanUserApi(userId, t),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.users({ filters, sort, pagination }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.users({ filters, sort, pagination })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        (old: UsersListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((user) =>
              user.id === userId
                ? { ...user, banned: false, banReason: null, banExpires: null }
                : user
            ),
          };
        }
      );

      return { previous };
    },
    onError: (err, userId, context) => {
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.unbanError", { item: t("common.labels.user") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.unbanned", { item: t("common.labels.user") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserApi(userId, t),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.users({ filters, sort, pagination }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.users({ filters, sort, pagination })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        (old: UsersListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.filter((user) => user.id !== userId),
            total: old.total - 1,
          };
        }
      );

      return { previous };
    },
    onError: (err, userId, context) => {
      queryClient.setQueryData(
        queryKeys.admin.users({ filters, sort, pagination }),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.deleteError", { item: t("common.labels.user") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("common.labels.user") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Reset password mutation (no optimistic update needed)
  const resetPasswordMutation = useMutation({
    mutationFn: ({
      userId,
      newPassword,
    }: {
      userId: string;
      newPassword: string;
    }) => resetPasswordApi(userId, newPassword, t),
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : t("common.passwordResetError")
      );
    },
    onSuccess: () => {
      toast.success(t("common.passwordReset"));
    },
  });

  return {
    // Data
    users: usersData?.users || [],
    total: usersData?.total || 0,
    page: usersData?.page || pagination.page,
    limit: usersData?.limit || pagination.limit,
    totalPages: usersData?.totalPages || 1,
    isLoading,
    error,

    // Functions
    refetch,
    fetchUserDetails: (userId: string) => fetchUserDetailsApi(userId, t),
    updateUser: async (
      userId: string,
      data: { name?: string; email?: string; role?: string }
    ): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync({ userId, data });
        return true;
      } catch {
        return false;
      }
    },
    banUser: async (
      userId: string,
      reason: string,
      expiresAt?: Date
    ): Promise<boolean> => {
      try {
        await banMutation.mutateAsync({ userId, reason, expiresAt });
        return true;
      } catch {
        return false;
      }
    },
    unbanUser: async (userId: string): Promise<boolean> => {
      try {
        await unbanMutation.mutateAsync(userId);
        return true;
      } catch {
        return false;
      }
    },
    deleteUser: async (userId: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(userId);
        return true;
      } catch {
        return false;
      }
    },
    resetPassword: async (
      userId: string,
      newPassword: string
    ): Promise<boolean> => {
      try {
        await resetPasswordMutation.mutateAsync({ userId, newPassword });
        return true;
      } catch {
        return false;
      }
    },
    fetchUsers: async (
      searchFilters: UserFilters,
      searchSort: UserSort,
      searchPagination: Pagination
    ): Promise<UsersListResponse | null> => {
      try {
        return await fetchUsersApi(
          searchFilters,
          searchSort,
          searchPagination,
          t
        );
      } catch {
        return null;
      }
    },
  };
}
