import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { queryKeys } from "@/lib/query-keys";
import {
  CalendarViewSettings,
  DEFAULT_PERSONAL_VIEW_SETTINGS,
  PersonalViewSettings,
  resolveViewSettings,
  sanitizePersonalViewSettings,
} from "@/lib/view-settings";

// Per-device keys: guests and auth-less instances keep using them, accounts migrate them once
const STORAGE_KEYS = {
  shiftsPerDay: "shifts-per-day",
  externalShiftsPerDay: "external-shifts-per-day",
  showShiftNotes: "show-shift-notes",
  sortType: "shift-sort-type",
  sortOrder: "shift-sort-order",
  combinedSort: "combined-sort-mode",
  hidePresetHeader: "hide-preset-header",
  highlightedWeekdays: "highlighted-weekdays",
  highlightColor: "highlight-color",
} as const;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, quota); the in-memory state still applies
  }
}

function parseLimit(raw: string | null): number | null | undefined {
  if (raw === null) return undefined;
  if (raw === "null") return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? undefined : parsed;
}

function parseBoolean(raw: string | null): boolean | undefined {
  return raw === null ? undefined : raw === "true";
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function hasLocalViewSettings(): boolean {
  return Object.values(STORAGE_KEYS).some((key) => readStorage(key) !== null);
}

function readLocalViewSettings(): PersonalViewSettings {
  if (typeof window === "undefined") return DEFAULT_PERSONAL_VIEW_SETTINGS;
  const hidePresetHeader = parseBoolean(readStorage(STORAGE_KEYS.hidePresetHeader));
  return sanitizePersonalViewSettings({
    shiftsPerDay: parseLimit(readStorage(STORAGE_KEYS.shiftsPerDay)),
    externalShiftsPerDay: parseLimit(readStorage(STORAGE_KEYS.externalShiftsPerDay)),
    showShiftNotes: parseBoolean(readStorage(STORAGE_KEYS.showShiftNotes)),
    sortType: readStorage(STORAGE_KEYS.sortType) ?? undefined,
    sortOrder: readStorage(STORAGE_KEYS.sortOrder) ?? undefined,
    combinedSort: parseBoolean(readStorage(STORAGE_KEYS.combinedSort)),
    showStampBar: hidePresetHeader === undefined ? undefined : !hidePresetHeader,
    highlightedWeekdays: parseJson(readStorage(STORAGE_KEYS.highlightedWeekdays)),
    highlightColor: readStorage(STORAGE_KEYS.highlightColor) ?? undefined,
  });
}

function writeLocalViewSettings(settings: PersonalViewSettings) {
  const limit = (value: number | null) => (value === null ? "null" : String(value));
  writeStorage(STORAGE_KEYS.shiftsPerDay, limit(settings.shiftsPerDay));
  writeStorage(STORAGE_KEYS.externalShiftsPerDay, limit(settings.externalShiftsPerDay));
  writeStorage(STORAGE_KEYS.showShiftNotes, String(settings.showShiftNotes));
  writeStorage(STORAGE_KEYS.sortType, settings.sortType);
  writeStorage(STORAGE_KEYS.sortOrder, settings.sortOrder);
  writeStorage(STORAGE_KEYS.combinedSort, String(settings.combinedSort));
  writeStorage(STORAGE_KEYS.hidePresetHeader, String(!settings.showStampBar));
  writeStorage(STORAGE_KEYS.highlightedWeekdays, JSON.stringify(settings.highlightedWeekdays));
  writeStorage(STORAGE_KEYS.highlightColor, settings.highlightColor);
}

async function fetchPersonalViewSettingsApi(): Promise<PersonalViewSettings | null> {
  const response = await fetch("/api/user/view-settings");
  if (!response.ok) {
    throw new Error(`Failed to fetch view settings: ${response.statusText}`);
  }
  const data = await response.json();
  return data.viewSettings ? sanitizePersonalViewSettings(data.viewSettings) : null;
}

async function updatePersonalViewSettingsApi(
  patch: Partial<PersonalViewSettings>
): Promise<PersonalViewSettings> {
  const response = await fetch("/api/user/view-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewSettings: patch }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to update view settings: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
  const data = await response.json();
  return sanitizePersonalViewSettings(data.viewSettings);
}

interface UpdateViewSettingsContext {
  previous: PersonalViewSettings | null | undefined;
}

/**
 * The personal view: stored in the account when signed in, in localStorage for
 * guests and with auth disabled. `forCalendar` applies a calendar's own view on top.
 */
export function useViewSettings() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { user, isLoading: sessionLoading } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const userId = isAuthEnabled && user ? user.id : null;

  // better-auth reports pending again on every guest refetch, so only the first load counts
  const [sessionSettled, setSessionSettled] = useState(!isAuthEnabled);
  if (!sessionSettled && !sessionLoading) setSessionSettled(true);
  const queryKey = queryKeys.userPreferences.viewSettings(userId ?? "");

  const [local, setLocal] = useState<PersonalViewSettings>(readLocalViewSettings);

  const {
    data: stored,
    isSuccess,
    isPending,
  } = useQuery({
    queryKey,
    queryFn: fetchPersonalViewSettingsApi,
    enabled: !!userId,
    refetchInterval: false,
    retry: 1,
  });

  // Until the account has a stored view, this device's values stand in for it
  const personal = userId ? (stored ?? local) : local;

  const { mutate } = useMutation<
    PersonalViewSettings,
    Error,
    Partial<PersonalViewSettings>,
    UpdateViewSettingsContext
  >({
    mutationKey: queryKey,
    mutationFn: updatePersonalViewSettingsApi,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PersonalViewSettings | null>(queryKey);
      queryClient.setQueryData<PersonalViewSettings | null>(queryKey, (old) =>
        sanitizePersonalViewSettings({ ...(old ?? personal), ...patch })
      );
      return { previous };
    },
    onError: (err, patch, context) => {
      if (context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      console.error("Failed to update view settings:", err);
      toast.error(t("common.updateError", { item: t("view.settingsTitle") }));
    },
    onSettled: () => {
      // Refetching while a later toggle is still in flight would flash the older value
      if (queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  // One-time move of this device's settings into an account that has none yet
  const migratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !isSuccess || stored !== null || migratedFor.current === userId) return;
    migratedFor.current = userId;
    if (hasLocalViewSettings()) mutate(readLocalViewSettings());
  }, [userId, isSuccess, stored, mutate]);

  const updatePersonal = useCallback(
    (patch: Partial<PersonalViewSettings>) => {
      if (userId) {
        mutate(patch);
        return;
      }
      const next = sanitizePersonalViewSettings({ ...local, ...patch });
      setLocal(next);
      writeLocalViewSettings(next);
    },
    [userId, mutate, local]
  );

  const forCalendar = useCallback(
    (calendar?: { viewSettings?: CalendarViewSettings | null } | null) =>
      resolveViewSettings(personal, calendar?.viewSettings),
    [personal]
  );

  return {
    personal,
    updatePersonal,
    forCalendar,
    /** True while a signed-in account's view is still loading, to avoid a flash of device values */
    loading: !sessionSettled || (!!userId && isPending),
    /** false for guests and auth-less instances, whose view lives on this device */
    storedInAccount: !!userId,
  };
}
