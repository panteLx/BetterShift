import { useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getCachedPassword } from "@/lib/password-cache";

interface PresetFormData {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  notes: string;
  isSecondary: boolean;
  isAllDay: boolean;
  hideFromStats: boolean;
}

interface UsePresetManagementOptions {
  calendarId: string;
  onSuccess: () => void;
}

export function usePresetManagement({
  calendarId,
  onSuccess,
}: UsePresetManagementOptions) {
  const t = useTranslations();

  const createPreset = useCallback(
    async (formData: PresetFormData) => {
      try {
        const password = getCachedPassword(calendarId);

        const response = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId,
            ...formData,
            password,
          }),
        });

        if (response.ok) {
          onSuccess();
          toast.success(t("common.created", { item: t("preset.preset") }));
          return true;
        } else {
          const data = await response.json();
          toast.error(
            data.error || t("common.createError", { item: t("preset.preset") })
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to create preset:", error);
        toast.error(t("common.createError", { item: t("preset.preset") }));
        return false;
      }
    },
    [calendarId, onSuccess, t]
  );

  const updatePreset = useCallback(
    async (presetId: string, formData: PresetFormData) => {
      try {
        const password = getCachedPassword(calendarId);

        const response = await fetch(`/api/presets/${presetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            password,
          }),
        });

        if (response.ok) {
          onSuccess();
          toast.success(t("common.updated", { item: t("preset.preset") }));
          return true;
        } else {
          const data = await response.json();
          toast.error(
            data.error || t("common.updateError", { item: t("preset.preset") })
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to update preset:", error);
        toast.error(t("common.updateError", { item: t("preset.preset") }));
        return false;
      }
    },
    [calendarId, onSuccess, t]
  );

  const deletePreset = useCallback(
    async (presetId: string) => {
      try {
        const password = getCachedPassword(calendarId);

        const response = await fetch(`/api/presets/${presetId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        if (response.ok) {
          onSuccess();
          toast.success(t("common.deleted", { item: t("preset.preset") }));
          return true;
        } else {
          const data = await response.json();
          toast.error(
            data.error || t("common.deleteError", { item: t("preset.preset") })
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to delete preset:", error);
        toast.error(t("common.deleteError", { item: t("preset.preset") }));
        return false;
      }
    },
    [calendarId, onSuccess, t]
  );

  const reorderPresets = useCallback(
    async (presetOrders: Array<{ id: string; order: number }>) => {
      try {
        const password = getCachedPassword(calendarId);

        const response = await fetch("/api/presets/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId,
            presetOrders,
            password,
          }),
        });

        if (response.ok) {
          onSuccess();
          return true;
        } else {
          const data = await response.json();
          toast.error(
            data.error || t("common.updateError", { item: t("preset.preset") })
          );
          return false;
        }
      } catch (error) {
        console.error("Failed to reorder presets:", error);
        toast.error(t("common.updateError", { item: t("preset.preset") }));
        return false;
      }
    },
    [calendarId, onSuccess, t]
  );

  return {
    createPreset,
    updatePreset,
    deletePreset,
    reorderPresets,
  };
}
