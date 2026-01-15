"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";

export interface CalendarShare {
  id: string;
  calendarId: string;
  userId: string;
  permission: "owner" | "admin" | "write" | "read";
  sharedBy: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  sharedByUser: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface SearchUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/**
 * Fetch calendar shares from API
 */
async function fetchSharesApi(calendarId: string): Promise<CalendarShare[]> {
  const response = await fetch(`/api/calendars/${calendarId}/shares`);

  if (!response.ok) {
    throw new Error("Failed to fetch shares");
  }

  const data = await response.json();

  // Parse date strings to Date objects
  return data.map((share: Record<string, unknown>) => ({
    ...share,
    createdAt: new Date(share.createdAt as string),
  }));
}

/**
 * Add a new share via API
 */
async function addShareApi(
  calendarId: string,
  userId: string,
  permission: "admin" | "write" | "read"
): Promise<CalendarShare> {
  const response = await fetch(`/api/calendars/${calendarId}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, permission }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to add share");
  }

  const data = await response.json();

  return {
    ...data,
    createdAt: new Date(data.createdAt),
  };
}

/**
 * Update a share's permission via API
 */
async function updateShareApi(
  calendarId: string,
  shareId: string,
  permission: "admin" | "write" | "read"
): Promise<CalendarShare> {
  const response = await fetch(
    `/api/calendars/${calendarId}/shares/${shareId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update share");
  }

  const data = await response.json();

  return {
    ...data,
    createdAt: new Date(data.createdAt),
  };
}

/**
 * Remove a share via API
 */
async function removeShareApi(
  calendarId: string,
  shareId: string
): Promise<void> {
  const response = await fetch(
    `/api/calendars/${calendarId}/shares/${shareId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to remove share");
  }
}

/**
 * Calendar Shares Hook
 *
 * Provides calendar share management with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Fetch shares for a calendar
 * - Add, update, and remove shares
 * - Optimistic updates for instant UI feedback
 * - User search functionality (local state)
 * - Automatic polling every 5 seconds
 *
 * @param calendarId - Calendar ID to manage shares for
 * @returns Object with shares data and management functions
 */
export function useCalendarShares(calendarId: string) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // User search state (not server data)
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch shares
  const { data: shares = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.shares.byCalendar(calendarId),
    queryFn: () => fetchSharesApi(calendarId),
    enabled: !!calendarId,
  });

  // Add share mutation
  const addShareMutation = useMutation({
    mutationFn: ({
      userId,
      permission,
    }: {
      userId: string;
      permission: "admin" | "write" | "read";
    }) => addShareApi(calendarId, userId, permission),
    onMutate: async ({ userId, permission }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
      const previous = queryClient.getQueryData(
        queryKeys.shares.byCalendar(calendarId)
      );

      // Optimistic update
      const optimisticShare: CalendarShare = {
        id: `temp-${Date.now()}`,
        calendarId,
        userId,
        permission,
        sharedBy: "current-user",
        createdAt: new Date(),
        user: {
          id: userId,
          name: null,
          email: "",
          image: null,
        },
        sharedByUser: {
          id: "current-user",
          name: null,
          email: "",
        },
      };

      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        (old: CalendarShare[] = []) => [optimisticShare, ...old]
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.createError", { item: t("share.share") })
      );
    },
    onSuccess: () => {
      toast.success(t("share.shareAdded"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
    },
  });

  // Update share mutation
  const updateShareMutation = useMutation({
    mutationFn: ({
      shareId,
      permission,
    }: {
      shareId: string;
      permission: "admin" | "write" | "read";
    }) => updateShareApi(calendarId, shareId, permission),
    onMutate: async ({ shareId, permission }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
      const previous = queryClient.getQueryData(
        queryKeys.shares.byCalendar(calendarId)
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        (old: CalendarShare[] = []) =>
          old.map((s) => (s.id === shareId ? { ...s, permission } : s))
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        context?.previous
      );
      toast.error(t("common.updateError", { item: t("share.share") }));
    },
    onSuccess: () => {
      toast.success(t("share.shareUpdated"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
    },
  });

  // Remove share mutation
  const removeShareMutation = useMutation({
    mutationFn: (shareId: string) => removeShareApi(calendarId, shareId),
    onMutate: async (shareId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
      const previous = queryClient.getQueryData(
        queryKeys.shares.byCalendar(calendarId)
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        (old: CalendarShare[] = []) => old.filter((s) => s.id !== shareId)
      );

      return { previous };
    },
    onError: (err, shareId, context) => {
      queryClient.setQueryData(
        queryKeys.shares.byCalendar(calendarId),
        context?.previous
      );
      toast.error(t("common.deleteError", { item: t("share.share") }));
    },
    onSuccess: () => {
      toast.success(t("share.shareRemoved"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shares.byCalendar(calendarId),
      });
    },
  });

  // User search (local state, not server state)
  const searchUsers = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(
            query
          )}&calendarId=${calendarId}`
        );

        if (!response.ok) {
          throw new Error("Failed to search users");
        }

        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Failed to search users:", error);
        toast.error(t("common.fetchError", { item: t("common.labels.users") }));
      } finally {
        setSearchLoading(false);
      }
    },
    [calendarId, t]
  );

  return {
    shares,
    loading,
    searchResults,
    searchLoading,
    addShare: async (
      userId: string,
      permission: "admin" | "write" | "read"
    ): Promise<{ success: boolean }> => {
      try {
        await addShareMutation.mutateAsync({ userId, permission });
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    updateShare: async (
      shareId: string,
      permission: "admin" | "write" | "read"
    ): Promise<{ success: boolean }> => {
      try {
        await updateShareMutation.mutateAsync({ shareId, permission });
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    removeShare: async (shareId: string): Promise<{ success: boolean }> => {
      try {
        await removeShareMutation.mutateAsync(shareId);
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    searchUsers,
  };
}
