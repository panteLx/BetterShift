"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint; below it the calendar uses the mobile layout. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

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
