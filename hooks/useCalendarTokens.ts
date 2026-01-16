"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

export interface CalendarAccessToken {
  id: string;
  tokenPreview: string; // First 6 chars (e.g., "abcxyz")
  token?: string; // Full token only provided on creation
  name: string | null;
  permission: "read" | "write";
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  isActive: boolean;
}

export interface CreateTokenParams {
  name?: string;
  permission: "read" | "write";
  expiresAt?: string | null;
}

/**
 * Safe error extraction helper
 * Handles non-JSON responses gracefully
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) {
      return response.statusText || `HTTP ${response.status}`;
    }
    try {
      const json = JSON.parse(text);
      return json.error || json.message || text;
    } catch {
      // Not JSON, return the text or fallback
      return text.includes("<")
        ? response.statusText || `HTTP ${response.status}`
        : text;
    }
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

/**
 * Fetch calendar access tokens from API
 */
async function fetchTokensApi(
  calendarId: string
): Promise<CalendarAccessToken[]> {
  const response = await fetch(`/api/calendars/${calendarId}/tokens`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Create a new access token via API
 * Returns full token (only time it's visible!)
 */
async function createTokenApi(
  calendarId: string,
  params: CreateTokenParams
): Promise<CalendarAccessToken> {
  const response = await fetch(`/api/calendars/${calendarId}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Update a token via API
 */
async function updateTokenApi(
  calendarId: string,
  tokenId: string,
  updates: { isActive?: boolean }
): Promise<CalendarAccessToken> {
  const response = await fetch(
    `/api/calendars/${calendarId}/tokens/${tokenId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }

  return await response.json();
}

/**
 * Delete (revoke) a token via API
 */
async function deleteTokenApi(
  calendarId: string,
  tokenId: string
): Promise<void> {
  const response = await fetch(
    `/api/calendars/${calendarId}/tokens/${tokenId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage);
  }
}

/**
 * Calendar Access Tokens Hook
 *
 * Provides calendar access token management with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Fetch access tokens for a calendar
 * - Create new tokens (returns full token only once!)
 * - Delete (revoke) tokens
 * - Optimistic updates for instant UI feedback
 * - Automatic polling every 5 seconds
 * - Helper functions for share links
 *
 * Note: Token update and regenerate are not supported in the UI.
 *
 * @param calendarId - Calendar ID to manage tokens for
 * @returns Object with tokens data and management functions
 */
export function useCalendarTokens(calendarId: string | null) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch tokens
  const {
    data: tokens = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.tokens.byCalendar(calendarId!),
    queryFn: () => fetchTokensApi(calendarId!),
    enabled: !!calendarId,
    refetchInterval: REFETCH_INTERVAL,
  });

  // Create token mutation (NO optimistic update - need real token!)
  const createTokenMutation = useMutation({
    mutationFn: (params: CreateTokenParams) =>
      createTokenApi(calendarId!, params),
    onSuccess: () => {
      toast.success(t("common.created", { item: t("token.accessLinks") }));
      // Invalidate to refetch and get updated list
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.byCalendar(calendarId!),
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.createError", { item: t("token.accessLinks") })
      );
    },
  });

  // Update token mutation
  const updateTokenMutation = useMutation({
    mutationFn: ({
      tokenId,
      updates,
    }: {
      tokenId: string;
      updates: { isActive?: boolean };
    }) => updateTokenApi(calendarId!, tokenId, updates),
    onMutate: async ({ tokenId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.tokens.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.tokens.byCalendar(calendarId!)
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.tokens.byCalendar(calendarId!),
        (old: CalendarAccessToken[] = []) =>
          old.map((token) =>
            token.id === tokenId ? { ...token, ...updates } : token
          )
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.tokens.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.updateError", { item: t("token.accessLinks") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("token.accessLinks") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.byCalendar(calendarId!),
      });
    },
  });

  // Delete token mutation
  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId: string) => deleteTokenApi(calendarId!, tokenId),
    onMutate: async (tokenId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.tokens.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.tokens.byCalendar(calendarId!)
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.tokens.byCalendar(calendarId!),
        (old: CalendarAccessToken[] = []) =>
          old.filter((token) => token.id !== tokenId)
      );

      return { previous };
    },
    onError: (err, tokenId, context) => {
      queryClient.setQueryData(
        queryKeys.tokens.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        err instanceof Error
          ? err.message
          : t("common.revokeError", { item: t("token.accessLinks") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.revoked", { item: t("token.accessLinks") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tokens.byCalendar(calendarId!),
      });
    },
  });

  /**
   * Generate a shareable link from token
   */
  const getShareLink = useCallback((token: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/token/${token}`;
  }, []);

  /**
   * Copy share link to clipboard
   */
  const copyShareLink = useCallback(
    async (token: string): Promise<boolean> => {
      try {
        const link = getShareLink(token);
        await navigator.clipboard.writeText(link);

        toast.success(t("common.copied", { item: t("share.share") }));

        return true;
      } catch {
        toast.error(t("common.copyError", { item: t("share.share") }));
        return false;
      }
    },
    [getShareLink, t]
  );

  return {
    tokens,
    isLoading,
    error,
    createToken: async (
      params: CreateTokenParams
    ): Promise<CalendarAccessToken | null> => {
      if (!calendarId) return null;
      try {
        return await createTokenMutation.mutateAsync(params);
      } catch {
        return null;
      }
    },
    updateToken: async (
      tokenId: string,
      updates: { isActive?: boolean }
    ): Promise<boolean> => {
      if (!calendarId) return false;
      try {
        await updateTokenMutation.mutateAsync({ tokenId, updates });
        return true;
      } catch {
        return false;
      }
    },
    deleteToken: async (tokenId: string): Promise<boolean> => {
      if (!calendarId) return false;
      try {
        await deleteTokenMutation.mutateAsync(tokenId);
        return true;
      } catch {
        return false;
      }
    },
    getShareLink,
    copyShareLink,
  };
}
