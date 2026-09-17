"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CalendarViewMode = "month" | "week" | "list";

/** Modes that have a surface; the switcher offers exactly these. */
export const AVAILABLE_VIEW_MODES: readonly CalendarViewMode[] = ["month", "week", "list"];

// Per-device like the view-setting keys in useViewSettings.ts, never synced to the account
const STORAGE_KEY = "calendar-view-mode";
const CHANGE_EVENT = "calendar-view-mode-change";

// Keeps the choice for the session when storage is unavailable (private mode)
let memory: CalendarViewMode | null = null;

function readMode(): CalendarViewMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as CalendarViewMode | null;
    // No stored value yet (or invalid) — fall back to the session's in-memory choice
    return stored && AVAILABLE_VIEW_MODES.includes(stored) ? stored : (memory ?? "month");
  } catch {
    return memory ?? "month";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useCalendarViewMode() {
  // The server snapshot keeps the first client render identical to SSR
  const mode = useSyncExternalStore(subscribe, readMode, () => "month" as const);
  const setMode = useCallback((next: CalendarViewMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      memory = next;
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode] as const;
}
