"use client";

import { useRef } from "react";

const SWIPE_THRESHOLD_PX = 60;
// Horizontal movement must clearly dominate vertical, so a page scroll never reads as a swipe
const AXIS_LOCK_RATIO = 1.5;

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/** Horizontal swipe-to-navigate; does not preventDefault, so vertical scrolling is unaffected. */
export function useSwipeNavigation(onSwipeLeft: () => void, onSwipeRight: () => void): SwipeHandlers {
  const origin = useRef<{ x: number; y: number } | null>(null);

  return {
    onTouchStart: (e) => {
      const touch = e.touches[0];
      origin.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (e) => {
      const start = origin.current;
      origin.current = null;
      const touch = e.changedTouches[0];
      if (!start || !touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * AXIS_LOCK_RATIO) return;
      if (deltaX < 0) onSwipeLeft();
      else onSwipeRight();
    },
  };
}
