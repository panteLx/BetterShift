"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint; below it the calendar uses the mobile layout. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

const noSubscribe = () => () => {};

/** False during SSR and the first render, true afterwards. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
}

/** Reads a value that only exists in the browser, without a hydration mismatch. */
export function useClientValue<T>(read: () => T, serverFallback: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverFallback);
}

export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback
  );
}
