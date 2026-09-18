import { useState, useEffect, useRef } from "react";
import { ShiftFormData } from "@/components/shift-sheet";
import { ShiftWithCalendar } from "@/lib/types";
import { formatDateToLocal } from "@/lib/date-utils";
import { usePresets, type ShiftPresetWithValues } from "@/hooks/usePresets";
import { DEFAULT_COLOR } from "@/lib/constants";

interface UseShiftFormOptions {
  open: boolean;
  shift?: ShiftWithCalendar;
  selectedDate?: Date;
  calendarId?: string;
}

export function useShiftForm({
  open,
  shift,
  selectedDate,
  calendarId,
}: UseShiftFormOptions) {
  const [formData, setFormData] = useState<ShiftFormData>({
    date:
      shift?.date && shift.date instanceof Date
        ? formatDateToLocal(shift.date)
        : selectedDate
        ? formatDateToLocal(selectedDate)
        : formatDateToLocal(new Date()),
    startTime: shift?.startTime || "09:00",
    endTime: shift?.endTime || "17:00",
    title: shift?.title || "",
    notes: shift?.notes || "",
    color: shift?.color || DEFAULT_COLOR,
    isAllDay: false,
    signupCapacity: shift?.signupCapacity ?? null,
    segments: shift?.segments ?? [],
    customFields: shift?.customFields ?? {},
  });

  const { presets, createPreset } = usePresets(calendarId);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [presetName, setPresetName] = useState("");

  const saveAsPresetHandler = async (shiftData: ShiftFormData) => {
    if (!presetName.trim() || !calendarId) return false;

    // Use the new createPreset mutation from usePresets
    const success = await createPreset({
      title: presetName,
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      color: shiftData.color || DEFAULT_COLOR,
      notes: shiftData.notes || "",
      groupName: "",
      isAllDay: shiftData.isAllDay || false,
      isSecondary: false,
      hideFromStats: false,
      segments: shiftData.segments ?? [],
      customFields: shiftData.customFields ?? {},
    });

    return success;
  };

  const applyPreset = (preset: ShiftPresetWithValues) => {
    setFormData({
      ...formData,
      startTime: preset.startTime,
      endTime: preset.endTime,
      title: preset.title,
      notes: preset.notes || "",
      color: preset.color,
      isAllDay: preset.isAllDay || false,
      signupCapacity: preset.defaultSignupCapacity ?? null,
      segments: preset.segments ?? [],
      // Copied at creation time only — editing the preset afterwards must not
      // affect shifts already created from it.
      customFields: preset.customFields ?? {},
    });
  };

  /** Drops the values a preset filled in, keeping the date. */
  const clearPreset = () => {
    setFormData({
      ...formData,
      startTime: "09:00",
      endTime: "17:00",
      title: "",
      notes: "",
      color: DEFAULT_COLOR,
      isAllDay: false,
      signupCapacity: null,
      segments: [],
      customFields: {},
    });
  };

  const resetForm = () => {
    setFormData({
      date: selectedDate
        ? formatDateToLocal(selectedDate)
        : formatDateToLocal(new Date()),
      startTime: "09:00",
      endTime: "17:00",
      title: "",
      notes: "",
      color: DEFAULT_COLOR,
      isAllDay: false,
      signupCapacity: null,
      segments: [],
      customFields: {},
    });
    setPresetName("");
    setSaveAsPreset(false);
  };

  // Sync form data when dialog state changes (refs only)
  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  });

  // Only update on mount or when key changes
  useEffect(() => {
    if (open) {
      const newFormData = {
        date:
          shift?.date && shift.date instanceof Date
            ? formatDateToLocal(shift.date)
            : selectedDate
            ? formatDateToLocal(selectedDate)
            : formatDateToLocal(new Date()),
        startTime: shift?.startTime || "09:00",
        endTime: shift?.endTime || "17:00",
        title: shift?.title || "",
        notes: shift?.notes || "",
        color: shift?.color || DEFAULT_COLOR,
        isAllDay: shift?.isAllDay || false,
        signupCapacity: shift?.signupCapacity ?? null,
        segments: shift?.segments ?? [],
        customFields: shift?.customFields ?? {},
      };

      // Compare form data fields directly
      const needsUpdate =
        formDataRef.current.date !== newFormData.date ||
        formDataRef.current.startTime !== newFormData.startTime ||
        formDataRef.current.endTime !== newFormData.endTime ||
        formDataRef.current.title !== newFormData.title ||
        formDataRef.current.notes !== newFormData.notes ||
        formDataRef.current.color !== newFormData.color ||
        formDataRef.current.isAllDay !== newFormData.isAllDay ||
        formDataRef.current.signupCapacity !== newFormData.signupCapacity ||
        JSON.stringify(formDataRef.current.segments ?? []) !==
          JSON.stringify(newFormData.segments ?? []) ||
        JSON.stringify(formDataRef.current.customFields ?? {}) !==
          JSON.stringify(newFormData.customFields ?? {});

      if (needsUpdate) {
        setFormData(newFormData);
        setSaveAsPreset(false);
        setPresetName("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shift?.id, selectedDate?.toString()]);

  return {
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
  };
}
