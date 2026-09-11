import { useCallback, useState } from "react";
import { ExternalSync } from "@/lib/db/schema";
import { DEFAULT_COLOR } from "@/lib/constants";

export type SyncDisplayMode = "normal" | "minimal";
export type SyncImportType = "url" | "file";

export interface ExternalSyncFormValues {
  name: string;
  url: string;
  color: string;
  displayMode: SyncDisplayMode;
  autoSyncInterval: number;
  isHidden: boolean;
  hideFromStats: boolean;
  importType: SyncImportType;
  file: File | null;
}

/** Minutes accepted by the external-syncs API; 0 means manual. */
export const AUTO_SYNC_INTERVALS = [0, 5, 15, 30, 60, 120, 360, 720, 1440];

export const EMPTY_SYNC_FORM: ExternalSyncFormValues = {
  name: "",
  url: "",
  color: DEFAULT_COLOR,
  displayMode: "normal",
  autoSyncInterval: 0,
  isHidden: false,
  hideFromStats: false,
  importType: "url",
  file: null,
};

export function syncToFormValues(sync: ExternalSync): ExternalSyncFormValues {
  return {
    ...EMPTY_SYNC_FORM,
    name: sync.name || "",
    url: sync.calendarUrl || "",
    color: sync.color || DEFAULT_COLOR,
    displayMode: sync.displayMode === "minimal" ? "minimal" : "normal",
    autoSyncInterval: sync.autoSyncInterval || 0,
    isHidden: sync.isHidden || false,
    hideFromStats: sync.hideFromStats || false,
  };
}

// The import method alone is not an unsaved change.
const TRACKED_FIELDS = [
  "name",
  "url",
  "color",
  "displayMode",
  "autoSyncInterval",
  "isHidden",
  "hideFromStats",
  "file",
] as const;

export function useExternalSyncForm() {
  const [values, setValues] = useState<ExternalSyncFormValues>(EMPTY_SYNC_FORM);
  const [initial, setInitial] = useState<ExternalSyncFormValues>(EMPTY_SYNC_FORM);

  const setField = useCallback(
    <K extends keyof ExternalSyncFormValues>(key: K, value: ExternalSyncFormValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: value })),
    []
  );

  const reset = useCallback((next: ExternalSyncFormValues = EMPTY_SYNC_FORM) => {
    setValues(next);
    setInitial(next);
  }, []);

  const isDirty = TRACKED_FIELDS.some((key) => values[key] !== initial[key]);

  return { values, setField, reset, isDirty };
}
