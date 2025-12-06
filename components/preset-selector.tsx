"use client";

import { useTranslations } from "next-intl";
import { ShiftPreset } from "@/lib/db/schema";
import { CalendarWithCount } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";
import { PresetList } from "@/components/preset-list";
import {
  PresetEditDialog,
  PresetFormData,
} from "@/components/preset-edit-dialog";
import { PresetManageDialog } from "@/components/preset-manage-dialog";
import { usePasswordProtection } from "@/hooks/usePasswordProtection";

interface PresetSelectorProps {
  calendars: CalendarWithCount[];
  presets: ShiftPreset[];
  selectedPresetId?: string;
  onSelectPreset: (presetId: string | undefined) => void;
  onPresetsChange: () => void;
  onShiftsChange?: () => void;
  onStatsRefresh?: () => void;
  calendarId: string;
  onPasswordRequired: (action: () => Promise<void>) => void;
  loading?: boolean;
}

export function PresetSelector({
  calendars,
  presets,
  selectedPresetId,
  onSelectPreset,
  onPresetsChange,
  onShiftsChange,
  onStatsRefresh,
  calendarId,
  onPasswordRequired,
  loading = false,
}: PresetSelectorProps) {
  const t = useTranslations();
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ShiftPreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const { withPasswordCheck, getPassword } = usePasswordProtection({
    calendarId,
    onPasswordRequired,
  });

  const handleCreateNew = async () => {
    await withPasswordCheck(async () => {
      setIsCreatingNew(true);
      setEditingPreset(null);
      setShowEditDialog(true);
    });
  };

  const handleEditPreset = async (preset: ShiftPreset) => {
    await withPasswordCheck(async () => {
      setIsCreatingNew(false);
      setEditingPreset(preset);
      setShowEditDialog(true);
    });
  };

  const handleSavePreset = async (formData: PresetFormData) => {
    try {
      const password = getPassword();

      if (isCreatingNew) {
        const response = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calendarId,
            ...formData,
            password,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to create preset: ${response.status} ${response.statusText}`,
            errorText
          );
          toast.error(t("preset.saveError"));
          return;
        }

        toast.success(t("preset.created"));
      } else if (editingPreset) {
        const response = await fetch(`/api/presets/${editingPreset.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to update preset: ${response.status} ${response.statusText}`,
            errorText
          );
          toast.error(t("preset.saveError"));
          return;
        }

        toast.success(t("preset.updated"));

        if (onShiftsChange) onShiftsChange();
        if (onStatsRefresh) onStatsRefresh();
      }

      onPresetsChange();

      if (isCreatingNew) {
        setShowEditDialog(false);
        setEditingPreset(null);
        setIsCreatingNew(false);
      }
    } catch (error) {
      console.error("Failed to save preset:", error);
      toast.error(t("preset.saveError"));
    }
  };

  const handleDeletePreset = async (id: string) => {
    await withPasswordCheck(async () => {
      if (!confirm(t("preset.deleteConfirm"))) return;

      try {
        const password = getPassword();

        const response = await fetch(`/api/presets/${id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to delete preset: ${response.status} ${response.statusText}`,
            errorText
          );
          toast.error(t("preset.deleteError"));
          return;
        }

        if (selectedPresetId === id) {
          onSelectPreset(undefined);
        }

        onPresetsChange();
        if (onShiftsChange) onShiftsChange();
        toast.success(t("preset.deleted"));
      } catch (error) {
        console.error("Failed to delete preset:", error);
        toast.error(t("preset.deleteError"));
      }
    });
  };

  return (
    <>
      <PresetList
        calendars={calendars}
        calendarId={calendarId}
        presets={presets}
        selectedPresetId={selectedPresetId}
        onSelectPreset={onSelectPreset}
        onCreateNew={handleCreateNew}
        onManageClick={() => setShowManageDialog(true)}
        loading={loading}
      />

      <PresetManageDialog
        open={showManageDialog}
        onOpenChange={setShowManageDialog}
        presets={presets}
        onCreateNew={() => {
          setShowManageDialog(false);
          handleCreateNew();
        }}
        onEdit={(preset) => {
          setShowManageDialog(false);
          handleEditPreset(preset);
        }}
        onDelete={handleDeletePreset}
      />

      <PresetEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        preset={editingPreset}
        isCreating={isCreatingNew}
        onSave={handleSavePreset}
      />
    </>
  );
}
