"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

type CalendarSource = "guest" | "shared";

export type AvailableCalendar = {
  id: string;
  name: string;
  color: string;
  guestPermission: string;
  permission?: string; // For shared calendars: actual share permission (owner/admin/write/read)
  owner: {
    id: string;
    name: string;
  } | null;
  isSubscribed: boolean;
  source: CalendarSource;
};

export type DismissedCalendar = {
  id: string;
  name: string;
  color: string;
  permission: string;
  owner: {
    id: string;
    name: string;
  } | null;
  source: CalendarSource;
};

type SubscriptionResponse = {
  available: AvailableCalendar[];
  dismissed: DismissedCalendar[];
};

/**
 * Fetch calendar subscriptions from API
 */
async function fetchSubscriptionsApi(): Promise<SubscriptionResponse> {
  const response = await fetch("/api/calendars/subscriptions");

  if (!response.ok) {
    throw new Error("Failed to fetch calendars");
  }

  return await response.json();
}

/**
 * Subscribe to a calendar via API
 */
async function subscribeApi(calendarId: string): Promise<void> {
  const response = await fetch("/api/calendars/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ calendarId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to subscribe");
  }
}

/**
 * Dismiss/Unsubscribe from a calendar via API
 */
async function dismissApi(calendarId: string): Promise<void> {
  const response = await fetch(`/api/calendars/subscriptions/${calendarId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to unsubscribe");
  }
}

/**
 * Calendar Subscriptions Hook
 *
 * Provides calendar subscription management with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Fetch available and dismissed calendars
 * - Subscribe to public calendars
 * - Dismiss/unsubscribe from calendars
 * - Optimistic updates for instant UI feedback
 * - Automatic polling every 5 seconds
 * - Automatic cache invalidation (no window events needed!)
 *
 * @returns Object with calendar subscription data and management functions
 */
export function useCalendarSubscriptions() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch subscriptions
  const {
    data,
    isLoading: loading,
    error: errorMessage,
  } = useQuery({
    queryKey: queryKeys.subscriptions.all,
    queryFn: fetchSubscriptionsApi,
    refetchInterval: REFETCH_INTERVAL,
  });

  const availableCalendars = data?.available ?? [];
  const dismissedCalendars = data?.dismissed ?? [];

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (variables: { calendarId: string; name: string }) =>
      subscribeApi(variables.calendarId),
    onMutate: async (variables) => {
      const { calendarId } = variables;
      await queryClient.cancelQueries({
        queryKey: queryKeys.subscriptions.all,
      });
      const previous = queryClient.getQueryData(queryKeys.subscriptions.all);

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.subscriptions.all,
        (old: SubscriptionResponse | undefined) => {
          if (!old) return old;

          const dismissedCal = old.dismissed.find(
            (cal) => cal.id === calendarId
          );
          const availableCal = old.available.find(
            (cal) => cal.id === calendarId
          );

          if (dismissedCal) {
            // Move from dismissed to available
            return {
              available: [
                ...old.available,
                {
                  id: dismissedCal.id,
                  name: dismissedCal.name,
                  color: dismissedCal.color,
                  guestPermission: dismissedCal.permission,
                  permission: dismissedCal.permission,
                  owner: dismissedCal.owner,
                  source: dismissedCal.source,
                  isSubscribed: true,
                },
              ],
              dismissed: old.dismissed.filter((cal) => cal.id !== calendarId),
            };
          } else if (availableCal) {
            // Mark as subscribed
            return {
              ...old,
              available: old.available.map((cal) =>
                cal.id === calendarId ? { ...cal, isSubscribed: true } : cal
              ),
            };
          }

          return old;
        }
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(queryKeys.subscriptions.all, context?.previous);
      toast.error(err instanceof Error ? err.message : "Failed to subscribe");
    },
    onSuccess: (_, variables) => {
      toast.success(
        t("calendar.subscriptionSuccess", {
          name: variables.name || "Calendar",
        })
      );
    },
    onSettled: () => {
      // Invalidate both subscriptions and main calendar list
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: dismissApi,
    onMutate: async (calendarId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.subscriptions.all,
      });
      const previous = queryClient.getQueryData(queryKeys.subscriptions.all);

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.subscriptions.all,
        (old: SubscriptionResponse | undefined) => {
          if (!old) return old;

          const calendar = old.available.find((cal) => cal.id === calendarId);
          if (!calendar) return old;

          return {
            available: old.available.filter((cal) => cal.id !== calendarId),
            dismissed: [
              ...old.dismissed,
              {
                id: calendar.id,
                name: calendar.name,
                color: calendar.color,
                permission: calendar.permission || calendar.guestPermission,
                owner: calendar.owner,
                source: calendar.source,
              },
            ],
          };
        }
      );

      return { previous };
    },
    onError: (err, calendarId, context) => {
      queryClient.setQueryData(queryKeys.subscriptions.all, context?.previous);
      toast.error(err instanceof Error ? err.message : "Failed to unsubscribe");
    },
    onSuccess: (_, calendarId) => {
      const data = queryClient.getQueryData<SubscriptionResponse>(
        queryKeys.subscriptions.all
      );
      const calendar =
        data?.available.find((cal) => cal.id === calendarId) ||
        data?.dismissed.find((cal) => cal.id === calendarId);
      toast.success(
        t("calendar.unsubscribeSuccess", { name: calendar?.name || "Calendar" })
      );
    },
    onSettled: () => {
      // Invalidate both subscriptions and main calendar list
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });

  return {
    availableCalendars,
    dismissedCalendars,
    loading,
    error: errorMessage ? errorMessage.message : null,
    subscribe: async (
      calendarId: string,
      calendarName: string
    ): Promise<boolean> => {
      try {
        await subscribeMutation.mutateAsync({ calendarId, name: calendarName });
        return true;
      } catch {
        return false;
      }
    },
    dismiss: async (
      calendarId: string,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _calendarName: string
    ): Promise<boolean> => {
      try {
        await dismissMutation.mutateAsync(calendarId);
        return true;
      } catch {
        return false;
      }
    },
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    },
  };
}
