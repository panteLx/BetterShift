"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";
import { isRateLimitError, handleRateLimitError } from "@/lib/rate-limit-client";

export interface CalendarFeed {
  token: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const EMPTY_FEED: CalendarFeed = { token: null, createdAt: null, lastUsedAt: null };

/** Marker so mutation `onError` handlers can skip the generic toast — `handleRateLimitError` already showed one. */
class RateLimitedError extends Error {}

async function fetchFeed(calendarId: string): Promise<CalendarFeed> {
  const response = await fetch(`/api/calendars/${calendarId}/feed-token`);
  if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
  return response.json();
}

export function useCalendarFeedToken(calendarId: string, enabled: boolean) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const key = queryKeys.feedToken.byCalendar(calendarId);

  const { data: feed = EMPTY_FEED, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: () => fetchFeed(calendarId),
    enabled,
  });

  const run = async (method: "POST" | "DELETE"): Promise<CalendarFeed> => {
    const response = await fetch(`/api/calendars/${calendarId}/feed-token`, { method });
    if (isRateLimitError(response)) {
      await handleRateLimitError(response, t);
      throw new RateLimitedError();
    }
    if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
    return method === "POST" ? response.json() : EMPTY_FEED;
  };

  const createMutation = useMutation({
    mutationFn: () => run("POST"),
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
      toast.success(t("export.feed.created"));
    },
    onError: (error) => {
      if (error instanceof RateLimitedError) return;
      toast.error(t("common.error"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => run("DELETE"),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CalendarFeed>(key);
      queryClient.setQueryData(key, EMPTY_FEED);
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous);
      if (error instanceof RateLimitedError) return;
      toast.error(t("common.error"));
    },
    onSuccess: () => {
      toast.success(t("export.feed.revoked"));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const feedUrl =
    feed.token && typeof window !== "undefined"
      ? `${window.location.origin}/api/feed/${feed.token}.ics`
      : null;

  return {
    feed,
    feedUrl,
    isLoading,
    isError,
    isMutating: createMutation.isPending || revokeMutation.isPending,
    createFeed: async () => !!(await createMutation.mutateAsync().catch(() => null)),
    revokeFeed: async () => !!(await revokeMutation.mutateAsync().catch(() => null)),
  };
}
