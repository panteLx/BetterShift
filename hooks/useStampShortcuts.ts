"use client";

import { useEffect } from "react";

interface UseStampShortcutsOptions {
  presetIds: string[];
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
  enabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Digits 1–9 arm or disarm the matching preset, Escape disarms. */
export function useStampShortcuts({
  presetIds,
  selectedPresetId,
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

      if (event.key === "Escape" && selectedPresetId) {
        onSelectPreset(undefined);
        return;
      }

      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index > 8) return;
      const id = presetIds[index];
      if (!id) return;
      event.preventDefault();
      onSelectPreset(id === selectedPresetId ? undefined : id);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, presetIds, selectedPresetId, onSelectPreset]);
}
