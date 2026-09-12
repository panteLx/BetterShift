"use client";

import { useEffect } from "react";

interface UseStampShortcutsOptions {
  presetIds: string[];
  selectedPresetIds: string[];
  onSelectPreset: (id: string | undefined, multiSelect?: boolean) => void;
  enabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Digits 1–9 arm or disarm the matching preset (replacing the selection),
 * Shift+digit adds/removes it from the selection instead, Escape clears all.
 */
export function useStampShortcuts({
  presetIds,
  selectedPresetIds,
  onSelectPreset,
  enabled = true,
}: UseStampShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Leave keys alone while a dialog or sheet owns the focus
      if (document.querySelector("[role='dialog'][data-state='open']")) return;

      if (event.key === "Escape" && selectedPresetIds.length > 0) {
        onSelectPreset(undefined);
        return;
      }

      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 8) return;
      const id = presetIds[index];
      if (!id) return;
      event.preventDefault();
      onSelectPreset(id, event.shiftKey);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, presetIds, selectedPresetIds, onSelectPreset]);
}
