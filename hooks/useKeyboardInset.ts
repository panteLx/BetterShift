"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

export interface KeyboardInset {
  /** Pixels the on-screen keyboard covers at the bottom of the layout viewport */
  bottom: number;
  /** Height that is still visible above the keyboard */
  viewportHeight: number;
}

// Below this a shrinking visual viewport is a collapsing browser toolbar, not a keyboard
const KEYBOARD_MIN_HEIGHT = 120;

function readInset(viewport: VisualViewport): KeyboardInset | null {
  const bottom = Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop
  );
  if (bottom <= KEYBOARD_MIN_HEIGHT) return null;
  return { bottom, viewportHeight: viewport.height };
}

/**
 * Tracks the on-screen keyboard. iOS only shrinks the visual viewport, so a
 * `position: fixed` sheet keeps sitting behind the keyboard unless it is pinned
 * to the visible area itself.
 */
export function useKeyboardInset(enabled: boolean): KeyboardInset | null {
  // useSyncExternalStore compares by identity, so an unchanged reading must
  // stay the same object. Per instance, not shared across mounted panels.
  const last = useRef<KeyboardInset | null>(null);

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

  const getSnapshot = useCallback(() => {
    const viewport = enabled ? window.visualViewport : null;
    const next = viewport ? readInset(viewport) : null;
    const prev = last.current;
    if (
      next &&
      prev &&
      prev.bottom === next.bottom &&
      prev.viewportHeight === next.viewportHeight
    ) {
      return prev;
    }
    last.current = next;
    return next;
  }, [enabled]);

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
