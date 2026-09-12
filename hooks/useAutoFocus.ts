"use client";

import { useCallback } from "react";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Ref callback that focuses the field on pointer devices only. On phones an
 * autofocus pops the on-screen keyboard the moment a sheet opens.
 */
export function useAutoFocusRef<T extends HTMLElement>(enabled = true) {
  const desktop = useMediaQuery(DESKTOP_QUERY, false);

  return useCallback(
    (element: T | null) => {
      if (element && enabled && desktop) element.focus();
    },
    [enabled, desktop]
  );
}
