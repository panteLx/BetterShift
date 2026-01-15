import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShiftPreset } from "@/lib/db/schema";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

// Form data interface
export interface PresetFormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  notes: string;
  isSecondary: boolean;
  isAllDay: boolean;
  hideFromStats: boolean;
}

// API functions
async function fetchPresetsApi(calendarId: string): Promise<ShiftPreset[]> {
  const params = new URLSearchParams({ calendarId });
  const response = await fetch(`/api/presets?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch presets: ${response.statusText}`);
  }

  return await response.json();
}

async function createPresetApi(
  calendarId: string,
  formData: PresetFormData
): Promise<ShiftPreset> {
  const response = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, calendarId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create preset");
  }

  return await response.json();
}

async function updatePresetApi(
  presetId: string,
  formData: PresetFormData
): Promise<ShiftPreset> {
  const response = await fetch(`/api/presets/${presetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update preset");
  }

  return await response.json();
}

async function deletePresetApi(presetId: string): Promise<void> {
  const response = await fetch(`/api/presets/${presetId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete preset");
  }
}

async function reorderPresetsApi(
  calendarId: string,
  presetOrders: Array<{ id: string; order: number }>
): Promise<void> {
  const response = await fetch("/api/presets/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarId, presetOrders }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to reorder presets");
  }
}

// Helper to create optimistic preset
function createOptimisticPreset(
  calendarId: string,
  formData: PresetFormData
): ShiftPreset {
  return {
    id: `temp-${Date.now()}`,
    calendarId,
    title: formData.title,
    startTime: formData.startTime,
    endTime: formData.endTime,
    color: formData.color,
    notes: formData.notes,
    isSecondary: formData.isSecondary,
    isAllDay: formData.isAllDay,
    hideFromStats: formData.hideFromStats,
    order: 999, // Will be corrected by server
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Main hook
export function usePresets(calendarId: string | undefined) {
  const queryClient = useQueryClient();
  const t = useTranslations();

  // Query for fetching presets
  const {
    data: presets = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.presets.byCalendar(calendarId!),
    queryFn: () => fetchPresetsApi(calendarId!),
    enabled: !!calendarId,
  });

  // Create preset mutation
  const createMutation = useMutation({
    mutationFn: (formData: PresetFormData) =>
      createPresetApi(calendarId!, formData),
    onMutate: async (formData) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.presets.byCalendar(calendarId!)
      );
      const optimisticPreset = createOptimisticPreset(calendarId!, formData);
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        (old: ShiftPreset[] = []) => [...old, optimisticPreset]
      );
      return { previous };
    },
    onError: (error, formData, context) => {
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.createError", { item: t("preset.preset") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.created", { item: t("preset.preset") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
    },
  });

  // Update preset mutation
  const updateMutation = useMutation({
    mutationFn: ({
      presetId,
      formData,
    }: {
      presetId: string;
      formData: PresetFormData;
    }) => updatePresetApi(presetId, formData),
    onMutate: async ({ presetId, formData }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.presets.byCalendar(calendarId!)
      );
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        (old: ShiftPreset[] = []) =>
          old.map((p) =>
            p.id === presetId
              ? {
                  ...p,
                  ...formData,
                  updatedAt: new Date(),
                }
              : p
          )
      );
      return { previous };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.updateError", { item: t("preset.preset") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("preset.preset") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
    },
  });

  // Delete preset mutation
  const deleteMutation = useMutation({
    mutationFn: (presetId: string) => deletePresetApi(presetId),
    onMutate: async (presetId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.presets.byCalendar(calendarId!)
      );
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        (old: ShiftPreset[] = []) => old.filter((p) => p.id !== presetId)
      );
      return { previous };
    },
    onError: (error, presetId, context) => {
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.deleteError", { item: t("preset.preset") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("preset.preset") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
    },
  });

  // Reorder presets mutation
  const reorderMutation = useMutation({
    mutationFn: (presetOrders: Array<{ id: string; order: number }>) =>
      reorderPresetsApi(calendarId!, presetOrders),
    onMutate: async (presetOrders) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
      const previous = queryClient.getQueryData(
        queryKeys.presets.byCalendar(calendarId!)
      );
      // Optimistically reorder
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        (old: ShiftPreset[] = []) => {
          const orderMap = new Map(presetOrders.map((po) => [po.id, po.order]));
          return [...old].sort((a, b) => {
            const orderA = orderMap.get(a.id) ?? a.order;
            const orderB = orderMap.get(b.id) ?? b.order;
            return orderA - orderB;
          });
        }
      );
      return { previous };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(
        queryKeys.presets.byCalendar(calendarId!),
        context?.previous
      );
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.updateError", { item: t("preset.preset") })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.presets.byCalendar(calendarId!),
      });
    },
  });

  // Return interface
  return {
    // Data
    presets,
    loading: isLoading,
    hasLoadedOnce: isFetched,

    // Mutations
    createPreset: async (formData: PresetFormData) => {
      try {
        await createMutation.mutateAsync(formData);
        return true;
      } catch {
        return false;
      }
    },
    updatePreset: async (presetId: string, formData: PresetFormData) => {
      try {
        await updateMutation.mutateAsync({ presetId, formData });
        return true;
      } catch {
        return false;
      }
    },
    deletePreset: async (presetId: string) => {
      try {
        await deleteMutation.mutateAsync(presetId);
        return true;
      } catch {
        return false;
      }
    },
    reorderPresets: async (
      presetOrders: Array<{ id: string; order: number }>
    ) => {
      try {
        await reorderMutation.mutateAsync(presetOrders);
        return true;
      } catch {
        return false;
      }
    },
  };
}
