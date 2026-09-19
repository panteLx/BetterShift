"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import type { SystemSettings } from "@/lib/system-settings";

// GET-only fields: whether TELEMETRY_ENABLED overrides the stored value, and
// the effective on/off state after that override is applied.
export interface SystemSettingsResponse extends SystemSettings {
  telemetryEnvManaged: boolean;
  telemetryResolved: boolean;
}

async function fetchSystemSettings(): Promise<SystemSettingsResponse> {
  const response = await fetch("/api/admin/system-settings");
  if (!response.ok) throw new Error(`Failed to fetch system settings: ${response.status}`);
  return response.json();
}

async function updateSystemSettingsApi(
  patch: Partial<SystemSettings>
): Promise<SystemSettings> {
  const response = await fetch("/api/admin/system-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`Failed to update system settings: ${response.status}`);
  return response.json();
}

interface UpdateSettingsContext {
  previous: SystemSettingsResponse | undefined;
}

/** Instance-wide toggles for the update-check banner, admin-only. */
export function useSystemSettings() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.systemSettings,
    queryFn: fetchSystemSettings,
  });

  const mutation = useMutation<SystemSettings, Error, Partial<SystemSettings>, UpdateSettingsContext>({
    mutationFn: updateSystemSettingsApi,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.admin.systemSettings });
      const previous = queryClient.getQueryData<SystemSettingsResponse>(queryKeys.admin.systemSettings);
      if (previous) {
        queryClient.setQueryData<SystemSettingsResponse>(queryKeys.admin.systemSettings, {
          ...previous,
          ...patch,
          // Derived server-side; without it the toggle would snap back until the refetch.
          telemetryResolved:
            !previous.telemetryEnvManaged && typeof patch.telemetryEnabled === "boolean"
              ? patch.telemetryEnabled
              : previous.telemetryResolved,
        });
      }
      return { previous };
    },
    onError: (err, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.admin.systemSettings, context.previous);
      }
      console.error("Failed to update system settings:", err);
      toast.error(t("admin.systemSettings.updateError"));
    },
    onSettled: (_data, _error, patch) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.systemSettings });
      if ("telemetryEnabled" in patch) {
        // The preview carries the instance id, which only exists once telemetry is on.
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.telemetryPayload("telemetry") });
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.telemetryPayload("diagnostics") });
      }
    },
  });

  return {
    settings: data,
    isLoading,
    updateSettings: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
