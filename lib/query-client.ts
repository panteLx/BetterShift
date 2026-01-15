import { QueryClient } from "@tanstack/react-query";

export const queryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 3000, // 3s - data considered fresh
      gcTime: 300000, // 5min - cache retention
      refetchInterval: 5000, // 5s polling for live updates
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex: number) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
};

export function createQueryClient() {
  return new QueryClient(queryClientConfig);
}
