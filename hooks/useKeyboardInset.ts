"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface KeyboardInset {
  /** Pixels the on-screen keyboard covers at the bottom of the layout viewport */
  bottom: number;
  /** Height that is still visible above the keyboard */
  viewportHeight: number;
}

// Below this a shrinking visual viewport is a collapsing browser toolbar, not a keyboard
const KEYBOARD_MIN_HEIGHT = 120;

// useSyncExternalStore compares by identity, so an unchanged reading must stay the same object
let lastInset: KeyboardInset | null = null;

function readInset(): KeyboardInset | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;

  const bottom = Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop
  );
  if (bottom <= KEYBOARD_MIN_HEIGHT) {
    lastInset = null;
    return null;
  }
  if (
    !lastInset ||
    lastInset.bottom !== bottom ||
    lastInset.viewportHeight !== viewport.height
  ) {
    lastInset = { bottom, viewportHeight: viewport.height };
  }
  return lastInset;
}

/**
 * Tracks the on-screen keyboard. iOS only shrinks the visual viewport, so a
 * `position: fixed` sheet keeps sitting behind the keyboard unless it is pinned
 * to the visible area itself.
 */
export function useKeyboardInset(enabled: boolean): KeyboardInset | null {
  const subscribe = useCallback(
    (notify: () => void) => {
      const viewport = enabled ? window.visualViewport : null;
      if (!viewport) return () => {};

      viewport.addEventListener("resize", notify);
      viewport.addEventListener("scroll", notify);
      return () => {
        viewport.removeEventListener("resize", notify);
        viewport.removeEventListener("scroll", notify);
      };
    },
    [enabled]
  );

  return useSyncExternalStore(
    subscribe,
    () => (enabled ? readInset() : null),
    () => null
  );
}
