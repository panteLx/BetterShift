"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormFields } from "@/components/shift-form-fields";
import { PresetSelect } from "@/components/preset-select";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { ShiftSignupList } from "@/components/shift-signup-list";
import { useShiftForm } from "@/hooks/useShiftForm";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useCalendars } from "@/hooks/useCalendars";
import { formatDateToLocal, formatLongDate, parseLocalDate } from "@/lib/date-utils";
import { isTempId } from "@/lib/utils";
import { validateTimeRanges, toTimeRanges, type TimeRange } from "@/lib/time-ranges";
import type { CustomFieldInputValue } from "@/lib/custom-fields";

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
  signupCapacity?: number | null;
  segments?: TimeRange[];
  /** New shifts only: people to sign up immediately once the shift is created. */
  signupUserIds?: string[];
  customFields?: Record<string, CustomFieldInputValue>;
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
    signupCapacity: data.signupCapacity ?? null,
    segments: data.segments ?? [],
    customFields: data.customFields ?? {},
  });
}

/** Whether any custom field carries a user-entered value (used for the new-shift "any data entered" check). */
function hasCustomFieldEntries(values?: Record<string, CustomFieldInputValue>) {
  if (!values) return false;
  return Object.values(values).some((v) => v !== null && v !== undefined && v !== "" && v !== false);
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
  const { calendars } = useCalendars();
  const splitShiftsEnabled = calendars.find((c) => c.id === calendarId)?.splitShiftsEnabled ?? false;
  const [isSaving, setIsSaving] = useState(false);

  // Determine if sheet should be in read-only mode
  const isReadOnly =
    readOnly ||
    (shift
      ? !permission.canOwned("editOwnShift", "editAnyShift", shift.createdBy ?? null)
      : !permission.can("createShift"));

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
  const [pendingSignupUserIds, setPendingSignupUserIds] = useState<string[]>([]);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedPresetId(null);
      setPendingSignupUserIds([]);
    }
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
            signupCapacity: shift.signupCapacity ?? null,
            segments: shift.segments ?? [],
            customFields: shift.customFields ?? {},
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
      presetName.trim() !== "" ||
      pendingSignupUserIds.length > 0 ||
      hasCustomFieldEntries(formData.customFields)
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
        segments: formData.isAllDay ? [] : formData.segments,
        ...(!shift ? { signupUserIds: pendingSignupUserIds } : {}),
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
      saveDisabled={
        !formData.title.trim() ||
        (shift && !hasChanges()) ||
        (!formData.isAllDay && !!validateTimeRanges(toTimeRanges(formData)))
      }
      saveLabel={shift ? undefined : t("shiftSheet.createAction")}
      hasUnsavedChanges={!isReadOnly && hasChanges()}
    >
      <div className="flex flex-col gap-3 lg:gap-4">
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
          splitShiftsEnabled={splitShiftsEnabled}
          calendarId={calendarId}
          syncedFromExternal={shift?.syncedFromExternal || !!shift?.externalSyncId}
        />

        {/* Signups aren't gated by isReadOnly: a read-only member may still
            be allowed to sign themselves up when the calendar permits it. A
            new (unsaved) shift uses local pending state instead of the API. */}
        {calendarId && (
          <ShiftSignupList
            calendarId={calendarId}
            signupCapacity={formData.signupCapacity ?? null}
            onSignupCapacityChange={(value) =>
              setFormData({ ...formData, signupCapacity: value })
            }
            readOnly={isReadOnly}
            shiftId={shift && !isTempId(shift.id) ? shift.id : undefined}
            pendingUserIds={pendingSignupUserIds}
            onPendingUserIdsChange={setPendingSignupUserIds}
          />
        )}
      </div>
    </BaseSheet>
  );
}
