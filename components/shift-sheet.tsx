"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormFields } from "@/components/shift-form-fields";
import { PresetSelect } from "@/components/preset-select";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { useShiftForm } from "@/hooks/useShiftForm";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { formatDateToLocal, formatLongDate, parseLocalDate } from "@/lib/date-utils";

interface ShiftSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (shift: ShiftFormData) => void | Promise<void>;
  selectedDate?: Date;
  shift?: ShiftWithCalendar;
  onPresetsChange?: () => void;
  calendarId?: string;
  readOnly?: boolean; // Explicitly set read-only mode
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

// presetId is left out: the form never changes it and does not load it
function snapshot(data: ShiftFormData) {
  return JSON.stringify({
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    title: data.title,
    notes: data.notes || "",
    color: data.color,
    isAllDay: data.isAllDay || false,
  });
}

export function ShiftSheet({
  open,
  onOpenChange,
  onSubmit,
  selectedDate,
  shift,
  onPresetsChange,
  calendarId,
  readOnly = false,
}: ShiftSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const permission = useCalendarPermission(calendarId);
  const [isSaving, setIsSaving] = useState(false);

  // Determine if sheet should be in read-only mode
  const isReadOnly = readOnly || !permission.canEdit;

  const {
    formData,
    setFormData,
    presets,
    saveAsPreset,
    setSaveAsPreset,
    presetName,
    setPresetName,
    applyPreset,
    clearPreset,
    saveAsPresetHandler,
    resetForm,
  } = useShiftForm({ open, shift, selectedDate, calendarId });
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelectedPresetId(null);
  }

  const initialSnapshot = useMemo(
    () =>
      shift
        ? snapshot({
            date:
              shift.date && shift.date instanceof Date
                ? formatDateToLocal(shift.date)
                : formatDateToLocal(new Date()),
            startTime: shift.startTime,
            endTime: shift.endTime,
            title: shift.title,
            notes: shift.notes || "",
            color: shift.color,
            isAllDay: shift.isAllDay || false,
          })
        : null,
    [shift]
  );

  const hasChanges = () => {
    if (shift && initialSnapshot) {
      return snapshot(formData) !== initialSnapshot;
    }

    // For new shifts, check if user has entered any data
    return (
      formData.title.trim() !== "" ||
      formData.notes?.trim() !== "" ||
      saveAsPreset ||
      presetName.trim() !== ""
    );
  };

  const handleSave = async () => {
    if (!formData.title.trim() || isSaving) return;

    setIsSaving(true);
    try {
      // If all-day, set default times for backend
      const submitData = {
        ...formData,
        startTime: formData.isAllDay ? "00:00" : formData.startTime,
        endTime: formData.isAllDay ? "23:59" : formData.endTime,
      };

      await onSubmit(submitData);

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
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresetSelect = (preset: Parameters<typeof applyPreset>[0]) => {
    setSelectedPresetId(preset.id);
    applyPreset(preset);
  };

  const handlePresetClear = () => {
    if (selectedPresetId === null) return;
    setSelectedPresetId(null);
    clearPreset();
  };

  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(formData.date)
    ? formatLongDate(parseLocalDate(formData.date), locale, { year: true })
    : undefined;

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={shift ? t("shift.edit") : t("shift.create")}
      description={dateLabel}
      showSaveButton={!isReadOnly}
      showCancelButton
      onSave={handleSave}
      isSaving={isSaving}
      saveDisabled={!formData.title.trim() || (shift && !hasChanges())}
      saveLabel={shift ? undefined : t("shiftSheet.createAction")}
      hasUnsavedChanges={!isReadOnly && hasChanges()}
    >
      <div className="flex flex-col gap-4">
        {isReadOnly && <ReadOnlyBanner message={t("guest.cannotEdit")} />}

        {!shift && !isReadOnly && (
          <PresetSelect
            presets={presets}
            value={selectedPresetId}
            onPresetSelect={handlePresetSelect}
            onClear={handlePresetClear}
          />
        )}

        <ShiftFormFields
          formData={formData}
          onFormDataChange={setFormData}
          saveAsPreset={saveAsPreset}
          onSaveAsPresetChange={setSaveAsPreset}
          presetName={presetName}
          onPresetNameChange={setPresetName}
          isEditing={!!shift}
          readOnly={isReadOnly}
        />
      </div>
    </BaseSheet>
  );
}
