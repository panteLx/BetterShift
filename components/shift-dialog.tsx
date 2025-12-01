"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormFields } from "@/components/shift-form-fields";
import { PresetSelect } from "@/components/preset-select";
import { useShiftForm } from "@/hooks/useShiftForm";

interface ShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (shift: ShiftFormData) => void;
  selectedDate?: Date;
  shift?: ShiftWithCalendar;
  onPresetsChange?: () => void;
  calendarId?: string;
}

export interface ShiftFormData {
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  color?: string;
  notes?: string;
  presetId?: string;
  isAllDay?: boolean;
}

export function ShiftDialog({
  open,
  onOpenChange,
  onSubmit,
  selectedDate,
  shift,
  onPresetsChange,
  calendarId,
}: ShiftDialogProps) {
  const t = useTranslations();

  const {
    formData,
    setFormData,
    presets,
    saveAsPreset,
    setSaveAsPreset,
    presetName,
    setPresetName,
    applyPreset,
    saveAsPresetHandler,
    resetForm,
    refetchPresets,
  } = useShiftForm({ open, shift, selectedDate, calendarId });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    // If all-day, set default times for backend
    const submitData = {
      ...formData,
      startTime: formData.isAllDay ? "00:00" : formData.startTime,
      endTime: formData.isAllDay ? "23:59" : formData.endTime,
    };

    onSubmit(submitData);

    // Save as preset if enabled and it's a new shift
    if (!shift && saveAsPreset && presetName.trim()) {
      const success = await saveAsPresetHandler(submitData);
      if (success && onPresetsChange) {
        onPresetsChange();
      }
    }

    if (!shift) {
      resetForm();
    }
    onOpenChange(false);
  };

  const handlePresetSelect = async (preset: Parameters<typeof applyPreset>[0]) => {
    applyPreset(preset);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {shift ? t("shift.edit") : t("shift.create")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {shift
              ? t("shift.editDescription", {
                  default: "Update the shift details",
                })
              : t("shift.createDescription", {
                  default: "Add a new shift to your calendar",
                })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* Preset Selection */}
            {!shift && <PresetSelect presets={presets} onPresetSelect={handlePresetSelect} />}

            <ShiftFormFields
              formData={formData}
              onFormDataChange={setFormData}
              saveAsPreset={saveAsPreset}
              onSaveAsPresetChange={setSaveAsPreset}
              presetName={presetName}
              onPresetNameChange={setPresetName}
              isEditing={!!shift}
            />
          </div>

          <div className="border-t border-border/50 bg-muted/20 p-4 flex gap-2.5 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 border-border/50 hover:bg-muted/50"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim()}
              className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
            >
              {shift ? t("shift.saveChanges") : t("shift.addShift")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
