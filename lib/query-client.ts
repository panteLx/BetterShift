import { QueryClient } from "@tanstack/react-query";
import { isClientError } from "@/lib/api-error";

/**
 * Polling tiers. `refetchOnWindowFocus` is what actually keeps the app feeling
 * live — returning to a tab refetches immediately — so the intervals only have
 * to cover a window someone is already watching.
 */
/** Shift-level data, which changes from another device while you watch */
export const LIVE_REFETCH_INTERVAL = 15000;
/** Everything else: calendars, presets, subscriptions, sync state, admin lists */
export const BACKGROUND_REFETCH_INTERVAL = 60000;

export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 10000,
      gcTime: 300000, // 5min - cache retention
      refetchInterval: BACKGROUND_REFETCH_INTERVAL,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount: number, error: unknown) =>
        !isClientError(error) && failureCount < 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
};

export function createQueryClient() {
  return new QueryClient(queryClientConfig);
}
