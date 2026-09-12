"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import type { User } from "@/lib/auth";
import { BACKGROUND_REFETCH_INTERVAL } from "@/lib/query-client";
import {
  AdminRequestError,
  toSearchParams,
  type AdminListResponse,
  type UserListCounts,
  type UserListParams,
} from "@/lib/admin-list";
import {
  patchListPages,
  restoreListPages,
  run,
  useAdminErrorToast,
} from "@/hooks/useAdminList";

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

export type UsersListResponse = AdminListResponse<AdminUser, UserListCounts>;

function parseAdminUser(user: Record<string, unknown>): AdminUser {
  return {
    ...(user as unknown as AdminUser),
    createdAt: new Date(user.createdAt as string),
    updatedAt: new Date(user.updatedAt as string),
    lastActivity: user.lastActivity ? new Date(user.lastActivity as string) : null,
    banExpires: user.banExpires ? new Date(user.banExpires as string) : null,
  };
}

/** One page of users; omitted params fall back to the API defaults. */
export async function fetchAdminUsers(
  params: Partial<UserListParams>,
): Promise<UsersListResponse> {
  const response = await fetch(`/api/admin/users?${toSearchParams(params)}`);
  if (!response.ok) throw new AdminRequestError(response.status);

  const data = await response.json();
  return { ...data, items: data.items.map(parseAdminUser) };
}

export async function fetchAdminUserDetails(userId: string): Promise<UserDetails> {
  const response = await fetch(`/api/admin/users/${userId}`);
  if (!response.ok) throw new AdminRequestError(response.status);

  const data = await response.json();

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
  t: ReturnType<typeof useTranslations>,
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
  t: ReturnType<typeof useTranslations>,
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
  t: ReturnType<typeof useTranslations>,
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
  t: ReturnType<typeof useTranslations>,
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
  t: ReturnType<typeof useTranslations>,
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
 * One page of the admin user list, filtered, sorted and paginated by the API.
 * The previous page stays visible while the next one loads.
 */
export function useAdminUsers(params: UserListParams) {
  const t = useTranslations();
  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: queryKeys.admin.users.list(params),
    queryFn: () => fetchAdminUsers(params),
    placeholderData: keepPreviousData,
    refetchInterval: BACKGROUND_REFETCH_INTERVAL,
  });

  useAdminErrorToast(
    error,
    "admin-users-error",
    t("common.fetchError", { item: t("common.labels.users") }),
  );

  return {
    users: data?.items ?? [],
    total: data?.total ?? 0,
    counts: data?.counts ?? null,
    // While the previous page is still on screen its served number would make the
    // pager target a page the user already asked for; the clamped one only counts
    // once it belongs to the request in flight.
    page: isPlaceholderData ? params.page : (data?.page ?? params.page),
    isLoading,
    isPlaceholderData,
  };
}

/**
 * User mutations for the admin panel. Updates are applied optimistically to every
 * cached page of the user list and rolled back on error.
 */
export function useAdminUserActions() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const patchUsers = (patch: (users: AdminUser[]) => AdminUser[]) =>
    patchListPages<AdminUser>(queryClient, queryKeys.admin.users.lists, patch);

  const onSettled = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
  };

  const updateMutation = useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: { name?: string; email?: string; role?: string };
    }) => updateUserApi(userId, data, t),
    onMutate: async ({ userId, data }) => ({
      snapshot: await patchUsers((users) =>
        users.map((user) => (user.id === userId ? { ...user, ...data } : user)),
      ),
    }),
    onError: (err, variables, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.updateError", { item: t("common.labels.user") }),
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("common.labels.user") }));
    },
    onSettled,
  });

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
    onMutate: async ({ userId, reason, expiresAt }) => ({
      snapshot: await patchUsers((users) =>
        users.map((user) =>
          user.id === userId
            ? { ...user, banned: true, banReason: reason, banExpires: expiresAt || null }
            : user,
        ),
      ),
    }),
    onError: (err, variables, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.banError", { item: t("common.labels.user") }),
      );
    },
    onSuccess: () => {
      toast.success(t("common.banned", { item: t("common.labels.user") }));
    },
    onSettled,
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => unbanUserApi(userId, t),
    onMutate: async (userId) => ({
      snapshot: await patchUsers((users) =>
        users.map((user) =>
          user.id === userId
            ? { ...user, banned: false, banReason: null, banExpires: null }
            : user,
        ),
      ),
    }),
    onError: (err, userId, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.unbanError", { item: t("common.labels.user") }),
      );
    },
    onSuccess: () => {
      toast.success(t("common.unbanned", { item: t("common.labels.user") }));
    },
    onSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUserApi(userId, t),
    onMutate: async (userId) => ({
      snapshot: await patchUsers((users) => users.filter((user) => user.id !== userId)),
    }),
    onError: (err, userId, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.deleteError", { item: t("common.labels.user") }),
      );
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("common.labels.user") }));
    },
    onSettled,
  });

  // No optimistic update: nothing in the list changes
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
        err instanceof Error ? err.message : t("common.passwordResetError"),
      );
    },
    onSuccess: () => {
      toast.success(t("common.passwordReset"));
    },
  });

  return {
    isUpdating: updateMutation.isPending,
    updateUser: (userId: string, data: { name?: string; email?: string; role?: string }) =>
      run(updateMutation.mutateAsync, { userId, data }),
    banUser: (userId: string, reason: string, expiresAt?: Date) =>
      run(banMutation.mutateAsync, { userId, reason, expiresAt }),
    unbanUser: (userId: string) => run(unbanMutation.mutateAsync, userId),
    deleteUser: (userId: string) => run(deleteMutation.mutateAsync, userId),
    resetPassword: (userId: string, newPassword: string) =>
      run(resetPasswordMutation.mutateAsync, { userId, newPassword }),
  };
}
